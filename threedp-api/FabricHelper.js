'use strict';
/*
 * Copyright IBM Corp All Rights Reserved
 *
 * SPDX-License-Identifier: Apache-2.0
 */
/*
 * Chaincode Invoke
 */

var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var os = require('os');
var member_user = null;
var store_path = path.join(__dirname, 'hfc-key-store');
console.log('Store path:' + store_path);
var tx_id = null;


// Create a new design record
function registerDesign(req, res, doc) {
    //Init fabric client
    var fabric_client = new Fabric_Client();

    // setup the fabric network
    var channel = fabric_client.newChannel("threedpchannel");
    var order = fabric_client.newOrderer("grpc://192.168.99.100:7050");
    channel.addOrderer(order);

    //add buyer peer
    var peer = fabric_client.newPeer("grpc://192.168.99.100:7051");
    channel.addPeer(peer);

    Fabric_Client.newDefaultKeyValueStore({ path: store_path })
        .then(state_store => {
            // assign the store to the fabric client
            fabric_client.setStateStore(state_store);
            var crypto_suite = Fabric_Client.newCryptoSuite();
            // use the same location for the state store (where the users' certificate are kept)
            // and the crypto store (where the users' keys are kept)
            var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
            crypto_suite.setCryptoKeyStore(crypto_store);
            fabric_client.setCryptoSuite(crypto_suite);

            // get the enrolled user from persistence, this user will sign all requests
            return fabric_client.getUserContext("serverUser", true);
        })
        .then(user_from_store => {
            if (user_from_store && user_from_store.isEnrolled()) {
                console.log("Successfully loaded serverUser from persistence");
                member_user = user_from_store;
            } else {
                throw new Error("Failed to get serverUser.... run registerUser.js");
            }

            // get a transaction id object based on the current user assigned to fabric client
            tx_id = fabric_client.newTransactionID();
            console.log("Assigning transaction_id: ", tx_id._transaction_id);

            // createRecord chaincode function - requires 4 args, ex: args: ['ABCD', 'NAME', 'DOB', 'ADDRESS'],
            // must send the proposal to endorsing peers
            var request = {
                chaincodeId: 'threedpcc',
                fcn: 'registerDesign',
                args: [doc.designID, doc.dbID, doc.ownerID, doc.ownerName, doc.ownerEmail],
                chainId: 'threedpchannel',
                txId: tx_id
            };

            // send the transaction proposal to the peers
            return channel.sendTransactionProposal(request);
        })
        .then(results => {
            var proposalResponses = results[0];
            var proposal = results[1];
            let isProposalGood = false;
            if (
                proposalResponses &&
                proposalResponses[0].response &&
                proposalResponses[0].response.status === 200
            ) {
                isProposalGood = true;
                console.log("Transaction proposal was good");
                res.redirect('/user/dashboard');
            } else {
                res.send({ code: "500", message: proposalResponses[0].response.message });
                console.error("Transaction proposal was bad");
            }
            if (isProposalGood) {
                console.log(
                    util.format(
                        'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                        proposalResponses[0].response.status,
                        proposalResponses[0].response.message
                    )
                );

                // build up the request for the orderer to have the transaction committed
                var request = {
                    proposalResponses: proposalResponses,
                    proposal: proposal
                };

                // set the transaction listener and set a timeout of 30 sec
                // if the transaction did not get committed within the timeout period,
                // report a TIMEOUT status
                var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
                var promises = [];

                var sendPromise = channel.sendTransaction(request);
                promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                // get an eventhub once the fabric client has a user assigned. The user
                // is required bacause the event registration must be signed
                let event_hub = fabric_client.newEventHub();
                event_hub.setPeerAddr("grpc://192.168.99.100:8053");

                // using resolve the promise so that result status may be processed
                // under the then clause rather than having the catch clause process
                // the status
                let txPromise = new Promise((resolve, reject) => {
                    let handle = setTimeout(() => {
                        event_hub.disconnect();
                        resolve({ event_status: "TIMEOUT" }); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
                    }, 3000);
                    event_hub.connect();
                    event_hub.registerTxEvent(
                        transaction_id_string,
                        (tx, code) => {
                            // this is the callback for transaction event status
                            // first some clean up of event listener
                            clearTimeout(handle);
                            event_hub.unregisterTxEvent(transaction_id_string);
                            event_hub.disconnect();

                            // now let the application know what happened
                            var return_status = {
                                event_status: code,
                                tx_id: transaction_id_string
                            };
                            if (code !== "VALID") {
                                console.error("The transaction was invalid, code = " + code);
                                resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
                            } else {
                                console.log(
                                    "The transaction has been committed on peer " +
                                    event_hub._ep._endpoint.addr
                                );
                                resolve(return_status);
                            }
                        },
                        err => {
                            //this is the callback if something goes wrong with the event registration or processing
                            reject(
                                new Error("There was a problem with the eventhub ::" + err)
                            );
                        }
                    );
                });
                promises.push(txPromise);

                return Promise.all(promises);
            } else {
                console.error(
                    "Failed to send Proposal or receive valid response. Response null or status is not 200. exiting..."
                );
                throw new Error(
                    "Failed to send Proposal or receive valid response. Response null or status is not 200. exiting..."
                );
            }
        })
        .then(results => {
            console.log(
                "Send transaction promise and event listener promise have completed"
            );
            // check the results in the order the promises were added to the promise all list
            if (results && results[0] && results[0].status === "SUCCESS") {
                console.log("Successfully sent transaction to the orderer.");
            } else {
                console.error(
                    "Failed to order the transaction. Error code: " + response.status
                );
            }

            if (results && results[1] && results[1].event_status === "VALID") {
                console.log(
                    "Successfully committed the change to the ledger by the peer"
                );
            } else {
                console.log(
                    "Transaction failed to be committed to the ledger due to ::" +
                    results[1].event_status
                );
            }
        })
        .catch(err => {
            console.error("Failed to invoke successfully :: " + err);
        });
}
// Add a new order
function createOrder(req, res, doc) {
    //Init fabric client
    var fabric_client = new Fabric_Client();

    // setup the fabric network
    var channel = fabric_client.newChannel("threedpchannel");
    var order = fabric_client.newOrderer("grpc://192.168.99.100:7050");
    channel.addOrderer(order);

    //add buyer peer
    var peer = fabric_client.newPeer("grpc://192.168.99.100:7051");
    channel.addPeer(peer);

    Fabric_Client.newDefaultKeyValueStore({ path: store_path })
        .then(state_store => {
            // assign the store to the fabric client
            fabric_client.setStateStore(state_store);
            var crypto_suite = Fabric_Client.newCryptoSuite();
            // use the same location for the state store (where the users' certificate are kept)
            // and the crypto store (where the users' keys are kept)
            var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
            crypto_suite.setCryptoKeyStore(crypto_store);
            fabric_client.setCryptoSuite(crypto_suite);

            // get the enrolled user from persistence, this user will sign all requests
            return fabric_client.getUserContext("serverUser", true);
        })
        .then(user_from_store => {
            if (user_from_store && user_from_store.isEnrolled()) {
                console.log("Successfully loaded serverUser from persistence");
                member_user = user_from_store;
            } else {
                throw new Error("Failed to get serverUser.... run registerUser.js");
            }

            // get a transaction id object based on the current user assigned to fabric client
            tx_id = fabric_client.newTransactionID();
            console.log("Assigning transaction_id: ", tx_id._transaction_id);

            // addReport chaincode function - requires 2 args, ex: args: ['ABCD', 'REPORT'],
            // must send the proposal to endorsing peers
            var request = {
                chaincodeId: 'threedpcc',
                fcn: 'createOrder',
                args: [doc.orderID, doc.designID, doc.customerID, doc.quantity, doc.printerID],
                chainId: 'threedpchannel',
                txId: tx_id
            };

            // send the transaction proposal to the peers
            return channel.sendTransactionProposal(request);
        })
        .then(results => {
            var proposalResponses = results[0];
            var proposal = results[1];
            let isProposalGood = false;
            if (
                proposalResponses &&
                proposalResponses[0].response &&
                proposalResponses[0].response.status === 200
            ) {
                isProposalGood = true;
                console.log(doc);
                //result = JSON.parse(proposalResponses[0]);
                console.log(proposalResponses[0].name)
                res.render('order-success', {details: doc})
            } else {
                res.send({ code: "500", message: proposalResponses[0].response.message });
                console.error("Transaction proposal was bad");
            }
            if (isProposalGood) {
                console.log(
                    util.format(
                        'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                        proposalResponses[0].response.status,
                        proposalResponses[0].response.message
                    )
                );

                // build up the request for the orderer to have the transaction committed
                var request = {
                    proposalResponses: proposalResponses,
                    proposal: proposal
                };

                // set the transaction listener and set a timeout of 30 sec
                // if the transaction did not get committed within the timeout period,
                // report a TIMEOUT status
                var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
                var promises = [];

                var sendPromise = channel.sendTransaction(request);
                promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                // get an eventhub once the fabric client has a user assigned. The user
                // is required bacause the event registration must be signed
                let event_hub = fabric_client.newEventHub();
                event_hub.setPeerAddr("grpc://192.168.99.100:8051");

                // using resolve the promise so that result status may be processed
                // under the then clause rather than having the catch clause process
                // the status
                let txPromise = new Promise((resolve, reject) => {
                    let handle = setTimeout(() => {
                        event_hub.disconnect();
                        resolve({ event_status: "TIMEOUT" }); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
                    }, 3000);
                    event_hub.connect();
                    event_hub.registerTxEvent(
                        transaction_id_string,
                        (tx, code) => {
                            // this is the callback for transaction event status
                            // first some clean up of event listener
                            clearTimeout(handle);
                            event_hub.unregisterTxEvent(transaction_id_string);
                            event_hub.disconnect();

                            // now let the application know what happened
                            var return_status = {
                                event_status: code,
                                tx_id: transaction_id_string
                            };
                            if (code !== "VALID") {
                                console.error("The transaction was invalid, code = " + code);
                                resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
                            } else {
                                console.log(
                                    "The transaction has been committed on peer " +
                                    event_hub._ep._endpoint.addr
                                );
                                resolve(return_status);
                            }
                        },
                        err => {
                            //this is the callback if something goes wrong with the event registration or processing
                            reject(
                                new Error("There was a problem with the eventhub ::" + err)
                            );
                        }
                    );
                });
                promises.push(txPromise);

                return Promise.all(promises);
            } else {
                console.error(
                    "Failed to send Proposal or receive valid response. Response null or status is not 200. exiting..."
                );
                throw new Error(
                    "Failed to send Proposal or receive valid response. Response null or status is not 200. exiting..."
                );
            }
        })
        .then(results => {
            console.log(
                "Send transaction promise and event listener promise have completed"
            );
            // check the results in the order the promises were added to the promise all list
            if (results && results[0] && results[0].status === "SUCCESS") {
                console.log("Successfully sent transaction to the orderer.");
            } else {
                console.error(
                    "Failed to order the transaction. Error code: " + response.status
                );
                // res.send({ code: "500", message: "LC request failed." });
            }

            if (results && results[1] && results[1].event_status === "VALID") {
                console.log(
                    "Successfully committed the change to the ledger by the peer"
                );
            } else {
                console.log(
                    "Transaction failed to be committed to the ledger due to ::" +
                    results[1].event_status
                );
            }
        })
        .catch(err => {
            console.error("Failed to invoke successfully :: " + err);
        });
}


// Get the order status
function getStatus(req, res, doc) {
    //Init fabric client
    var fabric_client = new Fabric_Client();

    // setup the fabric network
    var channel = fabric_client.newChannel("threedpchannel");
    var order = fabric_client.newOrderer("grpc://192.168.99.100:7050");
    channel.addOrderer(order);

    //add buyer peer
    var peer = fabric_client.newPeer("grpc://192.168.99.100:9051");
    channel.addPeer(peer);

    Fabric_Client.newDefaultKeyValueStore({ path: store_path })
        .then(state_store => {
            // assign the store to the fabric client
            fabric_client.setStateStore(state_store);
            var crypto_suite = Fabric_Client.newCryptoSuite();
            // use the same location for the state store (where the users' certificate are kept)
            // and the crypto store (where the users' keys are kept)
            var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
            crypto_suite.setCryptoKeyStore(crypto_store);
            fabric_client.setCryptoSuite(crypto_suite);

            // get the enrolled user from persistence, this user will sign all requests
            return fabric_client.getUserContext("serverUser", true);
        })
        .then(user_from_store => {
            if (user_from_store && user_from_store.isEnrolled()) {
                console.log("Successfully loaded serverUser from persistence");
                member_user = user_from_store;
            } else {
                throw new Error("Failed to get serverUser.... run registerUser.js");
            }

            // getReport chaincode function - requires 1 argument, ex: args: ['ABCD'],
            var request = {
                chaincodeId: 'threedpcc',
                fcn: 'getStatus',
                args: [doc.orderID],
                chainId: 'threedp'
            };

            // send the query proposal to the peer
            return channel.queryByChaincode(request);
        })
        .then(query_responses => {
            console.log("Query has completed, checking results");
            // query_responses could have more than one  results if there multiple peers were used as targets
            if (query_responses && query_responses.length == 1) {
                if (query_responses[0] instanceof Error) {
                    console.error("error from query = ", query_responses[0]);
                    res.send({ code: "500", message: "isuue with getting order" });
                } else {
                    console.log("Response is ", query_responses[0].toString())
                    var result = JSON.parse(query_responses[0]);
                    res.send(result)
                }
            } else {
                console.log("No payloads were returned from query");
                res.send({ code: "500", message: "No order found" });
            }
        })
        .catch(err => {
            console.error("Failed to query successfully :: " + err);
            res.send({ code: "500", message: "Issue with getting order details" });
        });
}


//Function to get the entire history of order
function getOrderHistory(req, res, doc) {
    //Init fabric client
    var fabric_client = new Fabric_Client();

    // setup the fabric network
    var channel = fabric_client.newChannel("threedpchannel");
    var order = fabric_client.newOrderer("grpc://192.168.99.100:7050");
    channel.addOrderer(order);

    //add buyer peer
    var peer = fabric_client.newPeer("grpc://192.168.99.100:7051");
    channel.addPeer(peer);

    Fabric_Client.newDefaultKeyValueStore({ path: store_path })
        .then(state_store => {
            // assign the store to the fabric client
            fabric_client.setStateStore(state_store);
            var crypto_suite = Fabric_Client.newCryptoSuite();
            // use the same location for the state store (where the users' certificate are kept)
            // and the crypto store (where the users' keys are kept)
            var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
            crypto_suite.setCryptoKeyStore(crypto_store);
            fabric_client.setCryptoSuite(crypto_suite);

            // get the enrolled user from persistence, this user will sign all requests
            return fabric_client.getUserContext("serverUser", true);
        })
        .then(user_from_store => {
            if (user_from_store && user_from_store.isEnrolled()) {
                console.log("Successfully loaded serverUser from persistence");
                member_user = user_from_store;
            } else {
                throw new Error("Failed to get serverUser.... run registerUser.js");
            }

            // getRecord chaincode function - requires 1 argument, ex: args: ['ABCD'],
            var request = {
                chaincodeId: 'threedpcc',
                fcn: 'getOrderHistory',
                args: [doc.orderID],
                chainId: 'threedpchannel'
            };

            // send the query proposal to the peer
            return channel.queryByChaincode(request);
        })
        .then(query_responses => {
            console.log("Query has completed, checking results");
            // query_responses could have more than one  results if there multiple peers were used as targets
            if (query_responses && query_responses.length == 1) {
                if (query_responses[0] instanceof Error) {
                    console.error("error from query = ", query_responses[0]);
                    res.send({ code: "500", message: "isuue with getting order history" });
                } else {
                    console.log("Response is ", query_responses[0].toString());
                    var result = JSON.parse(query_responses[0]);
                    Object.values(result).forEach(b => { console.log(b.Value.name) })
                    res.send(result);

                }
            } else {
                console.log("No payloads were returned from query");
                res.send({ code: "500", message: "No order history found" });
            }
        })
        .catch(err => {
            console.error("Failed to query successfully :: " + err);
            res.send({ code: "500", message: "Issue with getting order details" });
        });
}


//Function to change status of order
function changeStatus(req, res, doc) {
    //Init fabric client
    var fabric_client = new Fabric_Client();

    // setup the fabric network
    var channel = fabric_client.newChannel("threedpchannel");
    var order = fabric_client.newOrderer("grpc://192.168.99.100:7050");
    channel.addOrderer(order);

    //add buyer peer
    var peer = fabric_client.newPeer("grpc://192.168.99.100:7051");
    channel.addPeer(peer);

    Fabric_Client.newDefaultKeyValueStore({ path: store_path })
        .then(state_store => {
            // assign the store to the fabric client
            fabric_client.setStateStore(state_store);
            var crypto_suite = Fabric_Client.newCryptoSuite();
            // use the same location for the state store (where the users' certificate are kept)
            // and the crypto store (where the users' keys are kept)
            var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
            crypto_suite.setCryptoKeyStore(crypto_store);
            fabric_client.setCryptoSuite(crypto_suite);

            // get the enrolled user from persistence, this user will sign all requests
            return fabric_client.getUserContext("printerUser", true);
        })
        .then(user_from_store => {
            if (user_from_store && user_from_store.isEnrolled()) {
                console.log("Successfully loaded printerUser from persistence");
                member_user = user_from_store;
            } else {
                throw new Error("Failed to get printerUser.... run registerUser.js");
            }

            // get a transaction id object based on the current user assigned to fabric client
            tx_id = fabric_client.newTransactionID();
            console.log("Assigning transaction_id: ", tx_id._transaction_id);

            var request = {
                chaincodeId: 'threedpcc',
                fcn: 'changeStatus',
                args: [doc.orderID, doc.status],
                chainId: 'threedpchannel',
                txId: tx_id
            };

            // send the transaction proposal to the peers
            return channel.sendTransactionProposal(request);
        })
        .then(results => {
            var proposalResponses = results[0];
            var proposal = results[1];
            let isProposalGood = false;
            if (
                proposalResponses &&
                proposalResponses[0].response &&
                proposalResponses[0].response.status === 200
            ) {
                isProposalGood = true;
                console.log("Transaction proposal was good");
                res.render('itemsprocured', {message: 'Status updated!'})
            } else {
                res.send({ code: "500", message: proposalResponses[0].response.message });
                console.error("Transaction proposal was bad");
            }
            if (isProposalGood) {
                console.log(
                    util.format(
                        'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                        proposalResponses[0].response.status,
                        proposalResponses[0].response.message
                    )
                );

                // build up the request for the orderer to have the transaction committed
                var request = {
                    proposalResponses: proposalResponses,
                    proposal: proposal
                };

                // set the transaction listener and set a timeout of 30 sec
                // if the transaction did not get committed within the timeout period,
                // report a TIMEOUT status
                var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
                var promises = [];

                var sendPromise = channel.sendTransaction(request);
                promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                // get an eventhub once the fabric client has a user assigned. The user
                // is required bacause the event registration must be signed
                let event_hub = fabric_client.newEventHub();
                event_hub.setPeerAddr("grpc://192.168.99.100:8053");

                // using resolve the promise so that result status may be processed
                // under the then clause rather than having the catch clause process
                // the status
                let txPromise = new Promise((resolve, reject) => {
                    let handle = setTimeout(() => {
                        event_hub.disconnect();
                        resolve({ event_status: "TIMEOUT" }); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
                    }, 3000);
                    event_hub.connect();
                    event_hub.registerTxEvent(
                        transaction_id_string,
                        (tx, code) => {
                            // this is the callback for transaction event status
                            // first some clean up of event listener
                            clearTimeout(handle);
                            event_hub.unregisterTxEvent(transaction_id_string);
                            event_hub.disconnect();

                            // now let the application know what happened
                            var return_status = {
                                event_status: code,
                                tx_id: transaction_id_string
                            };
                            if (code !== "VALID") {
                                console.error("The transaction was invalid, code = " + code);
                                resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
                            } else {
                                console.log(
                                    "The transaction has been committed on peer " +
                                    event_hub._ep._endpoint.addr
                                );
                                resolve(return_status);
                            }
                        },
                        err => {
                            //this is the callback if something goes wrong with the event registration or processing
                            reject(
                                new Error("There was a problem with the eventhub ::" + err)
                            );
                        }
                    );
                });
                promises.push(txPromise);

                return Promise.all(promises);
            } else {
                console.error(
                    "Failed to send Proposal or receive valid response. Response null or status is not 200. exiting..."
                );
                throw new Error(
                    "Failed to send Proposal or receive valid response. Response null or status is not 200. exiting..."
                );
            }
        })
        .then(results => {
            console.log(
                "Send transaction promise and event listener promise have completed"
            );
            // check the results in the order the promises were added to the promise all list
            if (results && results[0] && results[0].status === "SUCCESS") {
                console.log("Successfully sent transaction to the orderer.");
            } else {
                console.error(
                    "Failed to order the transaction. Error code: " + response.status
                );
            }

            if (results && results[1] && results[1].event_status === "VALID") {
                console.log(
                    "Successfully committed the change to the ledger by the peer"
                );
            } else {
                console.log(
                    "Transaction failed to be committed to the ledger due to ::" +
                    results[1].event_status
                );
            }
        })
        .catch(err => {
            console.error("Failed to invoke successfully :: " + err);
        });
}

//Add new procurements by printer
function addProcurement(req, res, doc) {
    //Init fabric client
    var fabric_client = new Fabric_Client();

    // setup the fabric network
    var channel = fabric_client.newChannel("threedpchannel");
    var order = fabric_client.newOrderer("grpc://192.168.99.100:7050");
    channel.addOrderer(order);

    //add buyer peer
    var peer = fabric_client.newPeer("grpc://192.168.99.100:7051");
    channel.addPeer(peer);

    Fabric_Client.newDefaultKeyValueStore({ path: store_path })
        .then(state_store => {
            // assign the store to the fabric client
            fabric_client.setStateStore(state_store);
            var crypto_suite = Fabric_Client.newCryptoSuite();
            // use the same location for the state store (where the users' certificate are kept)
            // and the crypto store (where the users' keys are kept)
            var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
            crypto_suite.setCryptoKeyStore(crypto_store);
            fabric_client.setCryptoSuite(crypto_suite);

            // get the enrolled user from persistence, this user will sign all requests
            return fabric_client.getUserContext("printerUser", true);
        })
        .then(user_from_store => {
            if (user_from_store && user_from_store.isEnrolled()) {
                console.log("Successfully loaded printerUser from persistence");
                member_user = user_from_store;
            } else {
                throw new Error("Failed to get printerUser.... run registerUser.js");
            }

            // get a transaction id object based on the current user assigned to fabric client
            tx_id = fabric_client.newTransactionID();
            console.log("Assigning transaction_id: ", tx_id._transaction_id);
            var request = {
                chaincodeId: 'threedpcc',
                fcn: 'addProcurement',
                args: [doc.orderID, doc.items],
                chainId: 'threedpchannel',
                txId: tx_id
            };

            // send the transaction proposal to the peers
            return channel.sendTransactionProposal(request);
        })
        .then(results => {
            var proposalResponses = results[0];
            var proposal = results[1];
            let isProposalGood = false;
            if (
                proposalResponses &&
                proposalResponses[0].response &&
                proposalResponses[0].response.status === 200
            ) {
                isProposalGood = true;
                console.log("Transaction proposal was good");
                res.render('itemsprocured', {message: 'Material details added!'});
            } else {
                res.send({ code: "500", message: proposalResponses[0].response.message });
                console.error("Transaction proposal was bad");
            }
            if (isProposalGood) {
                console.log(
                    util.format(
                        'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                        proposalResponses[0].response.status,
                        proposalResponses[0].response.message
                    )
                );

                // build up the request for the orderer to have the transaction committed
                var request = {
                    proposalResponses: proposalResponses,
                    proposal: proposal
                };

                // set the transaction listener and set a timeout of 30 sec
                // if the transaction did not get committed within the timeout period,
                // report a TIMEOUT status
                var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
                var promises = [];

                var sendPromise = channel.sendTransaction(request);
                promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                // get an eventhub once the fabric client has a user assigned. The user
                // is required bacause the event registration must be signed
                let event_hub = fabric_client.newEventHub();
                event_hub.setPeerAddr("grpc://192.168.99.100:8051");

                // using resolve the promise so that result status may be processed
                // under the then clause rather than having the catch clause process
                // the status
                let txPromise = new Promise((resolve, reject) => {
                    let handle = setTimeout(() => {
                        event_hub.disconnect();
                        resolve({ event_status: "TIMEOUT" }); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
                    }, 3000);
                    event_hub.connect();
                    event_hub.registerTxEvent(
                        transaction_id_string,
                        (tx, code) => {
                            // this is the callback for transaction event status
                            // first some clean up of event listener
                            clearTimeout(handle);
                            event_hub.unregisterTxEvent(transaction_id_string);
                            event_hub.disconnect();

                            // now let the application know what happened
                            var return_status = {
                                event_status: code,
                                tx_id: transaction_id_string
                            };
                            if (code !== "VALID") {
                                console.error("The transaction was invalid, code = " + code);
                                resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
                            } else {
                                console.log(
                                    "The transaction has been committed on peer " +
                                    event_hub._ep._endpoint.addr
                                );
                                resolve(return_status);
                            }
                        },
                        err => {
                            //this is the callback if something goes wrong with the event registration or processing
                            reject(
                                new Error("There was a problem with the eventhub ::" + err)
                            );
                        }
                    );
                });
                promises.push(txPromise);

                return Promise.all(promises);
            } else {
                console.error(
                    "Failed to send Proposal or receive valid response. Response null or status is not 200. exiting..."
                );
                throw new Error(
                    "Failed to send Proposal or receive valid response. Response null or status is not 200. exiting..."
                );
            }
        })
        .then(results => {
            console.log(
                "Send transaction promise and event listener promise have completed"
            );
            // check the results in the order the promises were added to the promise all list
            if (results && results[0] && results[0].status === "SUCCESS") {
                console.log("Successfully sent transaction to the orderer.");
            } else {
                console.error(
                    "Failed to order the transaction. Error code: " + response.status
                );
            }

            if (results && results[1] && results[1].event_status === "VALID") {
                console.log(
                    "Successfully committed the change to the ledger by the peer"
                );
            } else {
                console.log(
                    "Transaction failed to be committed to the ledger due to ::" +
                    results[1].event_status
                );
            }
        })
        .catch(err => {
            console.error("Failed to invoke successfully :: " + err);
        });
}


//Get design ownership details
function getOwnershipDetails(req, res, doc) {
    //Init fabric client
    var fabric_client = new Fabric_Client();

    // setup the fabric network
    var channel = fabric_client.newChannel("threedpchannel");
    var order = fabric_client.newOrderer("grpc://192.168.99.100:7050");
    channel.addOrderer(order);

    //add buyer peer
    var peer = fabric_client.newPeer("grpc://192.168.99.100:9051");
    channel.addPeer(peer);

    Fabric_Client.newDefaultKeyValueStore({ path: store_path })
        .then(state_store => {
            // assign the store to the fabric client
            fabric_client.setStateStore(state_store);
            var crypto_suite = Fabric_Client.newCryptoSuite();
            // use the same location for the state store (where the users' certificate are kept)
            // and the crypto store (where the users' keys are kept)
            var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
            crypto_suite.setCryptoKeyStore(crypto_store);
            fabric_client.setCryptoSuite(crypto_suite);

            // get the enrolled user from persistence, this user will sign all requests
            return fabric_client.getUserContext("serverUser", true);
        })
        .then(user_from_store => {
            if (user_from_store && user_from_store.isEnrolled()) {
                console.log("Successfully loaded serverUser from persistence");
                member_user = user_from_store;
            } else {
                throw new Error("Failed to get serverUser.... run registerUser.js");
            }

            var request = {
                chaincodeId: 'threedpcc',
                fcn: 'getOwnershipDetails',
                args: [doc.designID],
                chainId: 'threedpchannel'
            };

            // send the query proposal to the peer
            return channel.queryByChaincode(request);
        })
        .then(query_responses => {
            console.log("Query has completed, checking results");
            // query_responses could have more than one  results if there multiple peers were used as targets
            if (query_responses && query_responses.length == 1) {
                if (query_responses[0] instanceof Error) {
                    console.error("error from query = ", query_responses[0]);
                    res.send({ code: "500", message: "isuue with getting report" });
                } else {
                    console.log("Response is ", query_responses[0].toString())
                    var result = JSON.parse(query_responses[0]);
                    res.send(result);
                }
            } else {
                console.log("No payloads were returned from query");
                res.send({ code: "500", message: "No report found" });
            }
        })
        .catch(err => {
            console.error("Failed to query successfully :: " + err);
            res.send({ code: "500", message: "Issue with getting report details" });
        });
}

let fabricHelper = {
    registerDesign: registerDesign,
    createOrder: createOrder,
    getStatus: getStatus,
    changeStatus: changeStatus,
    getOwnershipDetails: getOwnershipDetails,
    addProcurement: addProcurement,
    getOrderHistory: getOrderHistory
}

module.exports = fabricHelper;

echo "Setting up the network.."

echo "Creating channel genesis block.."
# Create the channel
docker exec -e "CORE_PEER_LOCALMSPID=serverMSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/server.threedp.com/users/Admin@server.threedp.com/msp" -e "CORE_PEER_ADDRESS=peer0.server.threedp.com:7051" cli peer channel create -o orderer.threedp.com:7050 -c threedpchannel -f /etc/hyperledger/configtx/threedpchannel.tx
sleep 5
echo "Channel genesis block created."

echo "peer0.server.threedp.com joining the channel..."
# Join peer0.manf.vlm.com to the channel.
docker exec -e "CORE_PEER_LOCALMSPID=serverMSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/server.threedp.com/users/Admin@server.threedp.com/msp" -e "CORE_PEER_ADDRESS=peer0.server.threedp.com:7051" cli peer channel join -b threedpchannel.block
sleep 5
echo "peer0.server.threedp.com joined the channel"

echo "peer0.printer.threedp.com joining the channel..."
# Join peer0.clinician.ehr.com to the channel.
docker exec -e "CORE_PEER_LOCALMSPID=printerMSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/printer.threedp.com/users/Admin@printer.threedp.com/msp" -e "CORE_PEER_ADDRESS=peer0.printer.threedp.com:7051" cli peer channel join -b threedpchannel.block
sleep 5
echo "peer0.printer.threedp.com joined the channel"


echo "Installing threedp chaincode to peer0.server.threedp.com..."
# install chaincode
# Install code on centAuth peer
docker exec -e "CORE_PEER_LOCALMSPID=serverMSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/server.threedp.com/users/Admin@server.threedp.com/msp" -e "CORE_PEER_ADDRESS=peer0.server.threedp.com:7051" cli peer chaincode install -n threedpcc -v 1.0 -p github.com/threedp/go -l golang
sleep 5
echo "Installed threedp chaincode to peer0.server.threedp.com "


echo "Installing threedp chaincode to peer0.printer.threedp.com...."
# Install code on clinician peer
docker exec -e "CORE_PEER_LOCALMSPID=printerMSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/printer.threedp.com/users/Admin@printer.threedp.com/msp" -e "CORE_PEER_ADDRESS=peer0.printer.threedp.com:7051" cli peer chaincode install -n threedpcc -v 1.0 -p github.com/threedp/go -l golang
sleep 5
echo "Installed threedp chaincode to peer0.printer.threedp.com"



echo "Instantiating threedp chaincode.."
docker exec -e "CORE_PEER_LOCALMSPID=serverMSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/server.threedp.com/users/Admin@server.threedp.com/msp" -e "CORE_PEER_ADDRESS=peer0.server.threedp.com:7051" cli peer chaincode instantiate -o orderer.threedp.com:7050 -C threedpchannel -n threedpcc -l golang -v 1.0 -c '{"Args":[""]}' -P "OR ('serverMSP.member','printerMSP.member')"
echo "Instantiated threedp chaincode."
echo "Following is the docker network....."

docker ps


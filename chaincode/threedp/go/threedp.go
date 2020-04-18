/*
 * This the smart contract for vehicle lifetime management
 */

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	sc "github.com/hyperledger/fabric/protos/peer"
)

// SmartContract structure
type SmartContract struct {
}

// Design Struct structure
type designStruct struct {
	DesignID             string `json:"designID"`
	DbID                 string `json:"dbID"`
	OwnerID				 string `json:"ownerID"`
	OwnerName	         string `json:"ownerName"`
	OwnerEmail			 string `json:"ownerEmail"`
}
// Order history struct
type orderRecordStruct struct{
	OrderID			string `json:"orderID"`
	DesignID		string `json:"designID"`
	CustomerID		string `json:"customerID"`
	Quantity		string `json:"quantity"`
	PrinterID		string `json:"printerID"`
	CurrentStatus	string `json:"currentStatus"`
	ItemsProcured	string `json:"itemsProcured"`
}
// Init SmartContract
func (s *SmartContract) Init(APIstub shim.ChaincodeStubInterface) sc.Response {
	return shim.Success(nil)
}

// Invoke SmartContract Invoke
func (s *SmartContract) Invoke(APIstub shim.ChaincodeStubInterface) sc.Response {
	// Retrieve the requested Smart Contract function and arguments
	function, args := APIstub.GetFunctionAndParameters()
	// Route to the appropriate handler function to interact with the ledger appropriately
	if function == "registerDesign" {
		return s.registerDesign(APIstub, args)
	} else if function == "createOrder" {
		return s.createOrder(APIstub, args)
	} else if function == "changeStatus" {
		return s.changeStatus(APIstub, args)
	} else if function == "addProcurement" {
		return s.addProcurement(APIstub, args)
	} else if function == "getStatus" {
		return s.getStatus(APIstub, args)
	} else if function == "getOrderHistory" {
		return s.getOrderHistory(APIstub, args)
	} else if function == "getOwnershipDetails" {
		return s.getOwnershipDetails(APIstub, args)
	}

	return shim.Error("Invalid Smart Contract function name.")
}

// registerDesign: Register the designs provided by customers with unique non changeable id
func (s *SmartContract) registerDesign(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	designID := args[0]
	dbID := args[1]
	ownerID := args[2]
	ownerName := args[3]
	ownerEmail := args[4]

	Design := designStruct {DesignID: designID,
		DbID:                   dbID,
		OwnerID:        		ownerID,
		OwnerName: 				ownerName,
		OwnerEmail:             ownerEmail}
	DesignBytes, err := json.Marshal(Design)
	if err != nil {
		return shim.Error("JSON Marshal failed.")
	}

	APIstub.PutState(designID, DesignBytes)
	fmt.Println("Design has been registered -> ", Design)

	return shim.Success(nil)
}

//Add a new printing order
func (s *SmartContract) createOrder(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	orderID := args[0]
	designID := args[1]
	customerID := args[2]
	quantity := args[3]
	printerID := args[4]

	Order := orderRecordStruct {OrderID: orderID,
		DesignID:               designID,
		CustomerID:        		customerID,
		Quantity : 				quantity,
		PrinterID:				printerID,
		CurrentStatus: 			"Order placed",
		ItemsProcured:			""}
	orderBytes, err := json.Marshal(Order)
	if err != nil {
		return shim.Error("JSON Marshal failed.")
	}

	APIstub.PutState(orderID, orderBytes)
	fmt.Println("Order created successfully -> ", Order)

	return shim.Success(nil)
}

//Function to change the current status of order

func (s *SmartContract) changeStatus(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	orderID := args[0]
	currentStatus := args[1]

	orderAsBytes, _ := APIstub.GetState(orderID)

	var order orderRecordStruct

	err := json.Unmarshal(orderAsBytes, &order)
	if err != nil {
		return shim.Error("Issue with Record json unmarshaling")
	}


	Order := orderRecordStruct{OrderID: order.OrderID,
		DesignID:             order.DesignID,
		CustomerID:       	  order.CustomerID,
		Quantity: 			  order.Quantity,
		PrinterID:         	  order.PrinterID,
		CurrentStatus: 		  currentStatus,
		ItemsProcured: 		  order.ItemsProcured}
		

	orderBytes, err := json.Marshal(Order)
	if err != nil {
		return shim.Error("Issue with Record json marshaling")
	}

	APIstub.PutState(Order.OrderID, orderBytes)
	fmt.Println("Status has been updated -> ", Order)

	return shim.Success(nil)
}

// Function to add the details of procured items
func (s *SmartContract) addProcurement(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	orderID := args[0]
	itemsProcured := args[1]

	orderAsBytes, _ := APIstub.GetState(orderID)

	var order orderRecordStruct

	err := json.Unmarshal(orderAsBytes, &order)
	if err != nil {
		return shim.Error("Issue with Record json unmarshaling")
	}


	Order := orderRecordStruct{OrderID: order.OrderID,
		DesignID:             order.DesignID,
		CustomerID:       	  order.CustomerID,
		Quantity: 			  order.Quantity,
		PrinterID:            order.PrinterID,
		CurrentStatus:		  "Items procured",
		ItemsProcured: 		  itemsProcured}
		

	orderBytes, err := json.Marshal(Order)
	if err != nil {
		return shim.Error("Issue with Record json marshaling")
	}

	APIstub.PutState(Order.OrderID, orderBytes)
	fmt.Println("Items procurement details added -> ", Order)

	return shim.Success(nil)
}


//Function to obtain the latest status of order
func (s *SmartContract) getStatus(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	orderID := args[0]
	orderAsBytes, _ := APIstub.GetState(orderID)

	return shim.Success(orderAsBytes)
	
}

//Function to obtain the ownership details of a design
func (s *SmartContract) getOwnershipDetails(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	designID := args[0]
	DesignAsBytes, _ := APIstub.GetState(designID)
	return shim.Success(DesignAsBytes)
	
}

//Function to get entire order history
func (s *SmartContract) getOrderHistory(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	orderID := args[0]

	resultsIterator, err := APIstub.GetHistoryForKey(orderID)
	if err != nil {
		return shim.Error("Error retrieving Record history with GetHistoryForKey")
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing historic values for the Report
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return shim.Error("Error retrieving next Record history.")
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"TxId\":")
		buffer.WriteString("\"")
		buffer.WriteString(response.TxId)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Value\":")
		// if it was a delete operation on given key, then we need to set the
		//corresponding value null. Else, we will write the response.Value
		//as-is (as the Value itself a JSON marble)
		if response.IsDelete {
			buffer.WriteString("null")
		} else {
			buffer.WriteString(string(response.Value))
		}

		buffer.WriteString(", \"Timestamp\":")
		buffer.WriteString("\"")
		buffer.WriteString(time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).String())
		buffer.WriteString("\"")

		buffer.WriteString(", \"IsDelete\":")
		buffer.WriteString("\"")
		buffer.WriteString(strconv.FormatBool(response.IsDelete))
		buffer.WriteString("\"")

		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- Getting record returning:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}


// Main function is only relevant in unit test mode. Only included here for completeness.
func main() {
	// Create a new Smart Contract
	err := shim.Start(new(SmartContract))
	if err != nil {
		fmt.Printf("Error creating new Smart Contract: %s", err)
	}
}

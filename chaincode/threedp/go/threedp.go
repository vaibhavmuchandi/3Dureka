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
	designID             string `json:"designID"`
	dbID                 string `json:"dbID"`
	ownerID				 string `json:"ownerID"`
	ownerName	         string `json:"ownerName"`
	ownerEmail			 string `json:"ownerEmail"`
}
// Order history struct
type orderRecordStruct struct{
	orderID			string `json:"orderID"`
	designID		string `json:"designID"`
	customerID		string `json:"customerID"`
	quantity		string `json:"quantity"`
	printerID		string `json:"printerID"`
	currentStatus	string `json:"currentStatus"`
	itemsProcured	string `json:"itemsProcured"`
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

	DesignID := args[0]
	DbID := args[1]
	OwnerID := args[2]
	OwnerName := args[3]
	OwnerEmail := args[4]

	Design := designStruct {designID: DesignID,
		dbID:                   DbID,
		ownerID:        		OwnerID,
		ownerName: 				OwnerName,
		ownerEmail:             OwnerEmail}
	DesignBytes, err := json.Marshal(Design)
	if err != nil {
		return shim.Error("JSON Marshal failed.")
	}

	APIstub.PutState(DesignID, DesignBytes)
	fmt.Println("Design has been registered -> ", Design)

	return shim.Success(nil)
}

//Add a new printing order
func (s *SmartContract) createOrder(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	OrderID := args[0]
	DesignID := args[1]
	CustomerID := args[2]
	Quantity := args[3]
	PrinterID := args[4]

	Order := orderRecordStruct {orderID: OrderID,
		designID:               DesignID,
		customerID:        		CustomerID,
		quantity : 				Quantity,
		printerID:				PrinterID,
		currentStatus: 			"Order placed",
		itemsProcured:			""}
	orderBytes, err := json.Marshal(Order)
	if err != nil {
		return shim.Error("JSON Marshal failed.")
	}

	APIstub.PutState(OrderID, orderBytes)
	fmt.Println("Order created successfully -> ", Order)

	return shim.Success(nil)
}

//Function to change the current status of order

func (s *SmartContract) changeStatus(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	OrderID := args[0]
	status := args[1]

	orderAsBytes, _ := APIstub.GetState(OrderID)

	var order orderRecordStruct

	err := json.Unmarshal(orderAsBytes, &order)
	if err != nil {
		return shim.Error("Issue with Record json unmarshaling")
	}


	Order := orderRecordStruct{orderID: order.orderID,
		designID:             order.designID,
		customerID:       	  order.customerID,
		quantity: 			  order.quantity,
		printerID:         	  order.printerID,
		currentStatus: 		  status,
		itemsProcured: 		  order.itemsProcured}
		

	orderBytes, err := json.Marshal(Order)
	if err != nil {
		return shim.Error("Issue with Record json marshaling")
	}

	APIstub.PutState(Order.orderID, orderBytes)
	fmt.Println("Status has been updated -> ", Order)

	return shim.Success(nil)
}

// Function to add the details of procured items
func (s *SmartContract) addProcurement(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	OrderID := args[0]
	items := args[1]

	orderAsBytes, _ := APIstub.GetState(OrderID)

	var order orderRecordStruct

	err := json.Unmarshal(orderAsBytes, &order)
	if err != nil {
		return shim.Error("Issue with Record json unmarshaling")
	}


	Order := orderRecordStruct{orderID: order.orderID,
		designID:             order.designID,
		customerID:       	  order.customerID,
		quantity: 			  order.quantity,
		printerID:            order.printerID,
		currentStatus:		  "Items procured",
		itemsProcured: 		  items}
		

	orderBytes, err := json.Marshal(Order)
	if err != nil {
		return shim.Error("Issue with Record json marshaling")
	}

	APIstub.PutState(Order.orderID, orderBytes)
	fmt.Println("Items procurement details added -> ", Order)

	return shim.Success(nil)
}


//Function to obtain the latest status of order
func (s *SmartContract) getStatus(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	OrderID := args[0]
	orderAsBytes, _ := APIstub.GetState(OrderID)

	return shim.Success(orderAsBytes)
	
}

//Function to obtain the ownership details of a design
func (s *SmartContract) getOwnershipDetails(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	DesignID := args[0]
	DesignAsBytes, _ := APIstub.GetState(DesignID)

	return shim.Success(DesignAsBytes)
	
}

//Function to get entire order history
func (s *SmartContract) getOrderHistory(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	OrderID := args[0]

	resultsIterator, err := APIstub.GetHistoryForKey(OrderID)
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

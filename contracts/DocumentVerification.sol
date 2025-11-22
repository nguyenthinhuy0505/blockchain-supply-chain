// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DocumentVerification {
    struct Document {
        string documentHash;
        address owner;
        uint256 timestamp;
        string documentType;
        bool verified;
    }
    
    mapping(string => Document) public documents;
    mapping(address => string[]) public userDocuments;
    
    event DocumentRegistered(string indexed documentHash, address indexed owner, uint256 timestamp);
    
    function registerDocument(string memory _documentHash, string memory _documentType) public {
        require(bytes(documents[_documentHash].documentHash).length == 0, "Document already registered");
        
        documents[_documentHash] = Document({
            documentHash: _documentHash,
            owner: msg.sender,
            timestamp: block.timestamp,
            documentType: _documentType,
            verified: true
        });
        
        userDocuments[msg.sender].push(_documentHash);
        emit DocumentRegistered(_documentHash, msg.sender, block.timestamp);
    }
    
    function verifyDocument(string memory _documentHash) public view returns (bool) {
        return documents[_documentHash].verified && documents[_documentHash].owner != address(0);
    }
    
    function getUserDocuments(address _user) public view returns (string[] memory) {
        return userDocuments[_user];
    }
}
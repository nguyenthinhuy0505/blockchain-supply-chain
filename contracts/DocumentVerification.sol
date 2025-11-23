// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DocumentVerification {
    // Sửa: Loại bỏ documentHash lặp lại trong struct
    struct Document {
        address owner; // Trường này là quan trọng nhất để kiểm tra sự tồn tại
        uint256 timestamp;
        string documentType;
        // Giữ verified nếu bạn cần nó, nhưng thường sự tồn tại đã là verified=true
        bool verified; 
    }
    
    // Mapping: documentHash => Document Info
    mapping(string => Document) public documents; 
    
    // Mapping: ownerAddress => List of Hashes
    mapping(address => string[]) public userDocuments;
    
    event DocumentRegistered(string indexed documentHash, address indexed owner, uint256 timestamp);
    
    // Hàm khởi tạo (Constructor) có thể được thêm vào để đặt tên hợp đồng (nếu cần)
    // constructor() { ... }

    function registerDocument(string memory _documentHash, string memory _documentType) public {
        // SỬA LỖI QUAN TRỌNG NHẤT:
        // Kiểm tra xem trường owner có phải là địa chỉ mặc định (address(0)) không.
        // Nếu owner KHÁC address(0), tài liệu đã tồn tại.
        require(documents[_documentHash].owner == address(0), "Document already registered.");
        
        // Cập nhật Struct
        documents[_documentHash] = Document({
            owner: msg.sender,
            timestamp: block.timestamp,
            documentType: _documentType,
            verified: true
        });
        
        // Thêm hash vào danh sách của người dùng
        userDocuments[msg.sender].push(_documentHash);
        
        emit DocumentRegistered(_documentHash, msg.sender, block.timestamp);
    }
    
    function verifyDocument(string memory _documentHash) public view returns (bool) {
        // Cải tiến: Chỉ cần kiểm tra owner != address(0) là đủ
        // vì verified luôn là true khi đăng ký
        return documents[_documentHash].owner != address(0);
        
        // Hoặc giữ nguyên logic cũ nếu bạn muốn kiểm tra rõ ràng:
        // return documents[_documentHash].verified && documents[_documentHash].owner != address(0);
    }
    
    function getUserDocuments(address _user) public view returns (string[] memory) {
        return userDocuments[_user];
    }
}
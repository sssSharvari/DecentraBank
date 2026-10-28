
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Bank {
    struct Account {
        uint256 balance;
        address owner;
    }

    mapping(address => Account) private accounts;
    address private bankOwner;

    event AccountCreated(address indexed owner);
    event Deposite(address indexed owner, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Withdrawal(address indexed owner, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == bankOwner, "Not the Bank owner");
        _;
    }

    modifier onlyAccountOwner() {
        require(
            accounts[msg.sender].owner == msg.sender,
            "Account does not exist"
        );
        _;
    }

    constructor() {
        bankOwner = msg.sender;
    }

    function createAccount() public {
        require(
            accounts[msg.sender].owner == address(0),
            "Account already exists"
        );

        accounts[msg.sender] = Account({
            balance: 0,
            owner: msg.sender
        });

        emit AccountCreated(msg.sender);
    }

    // Check whether any wallet has a bank account.
    function accountExists(address user) public view returns (bool) {
        return accounts[user].owner != address(0);
    }

    // Get the connected caller's internal bank balance.
    function getBalance() public view onlyAccountOwner returns (uint256) {
        return accounts[msg.sender].balance;
    }

    function deposite() public payable onlyAccountOwner {
        require(msg.value > 0, "Deposit amount must be greater than zero");

        accounts[msg.sender].balance += msg.value;
        emit Deposite(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) public onlyAccountOwner {
        require(amount > 0, "Amount must be greater than zero");
        require(
            accounts[msg.sender].balance >= amount,
            "Insufficient balance"
        );
        require(
            address(this).balance >= amount,
            "Insufficient contract funds"
        );

        accounts[msg.sender].balance -= amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ETH transfer failed");

        emit Withdrawal(msg.sender, amount);
    }

    // Internal transfer: credit the recipient's bank balance.
    // The recipient withdraws ETH separately when needed.
    function transfer(
        address to,
        uint256 amount
    ) public onlyAccountOwner {
        require(to != address(0), "Invalid recipient address");
        require(to != msg.sender, "Cannot transfer to yourself");
        require(
            accounts[to].owner != address(0),
            "Recipient account does not exist"
        );
        require(amount > 0, "Amount must be greater than zero");
        require(
            accounts[msg.sender].balance >= amount,
            "Insufficient balance"
        );

        accounts[msg.sender].balance -= amount;
        accounts[to].balance += amount;

        emit Transfer(msg.sender, to, amount);
    }
}

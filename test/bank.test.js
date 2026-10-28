
const Bank = artifacts.require("Bank");

contract("Bank", (accounts) => {
  it("should deploy the Bank contract", async () => {
    const bank = await Bank.deployed();
    assert(bank.address);
  });
});

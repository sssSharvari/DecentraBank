"use strict";

const contractAddress = "0x9818820cc2C068Df7f391e8921A120B1B5bd7E63";
const abi = [
  {"inputs":[],"name":"createAccount","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"accountExists","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"getBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"deposite","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

let web3 = null, contract = null, currentAccount = null, busy = false;
const $ = (id) => document.getElementById(id);
function setText(id, value) { const n = $(id); if (n) n.textContent = value; }
function shortAddress(a) { return a ? `${a.slice(0,6)}...${a.slice(-4)}` : "Not connected"; }

function showStatus(title, message, success = true) {
  setText("statusTitle", title); setText("statusText", message); setText("statusIcon", success ? "✓" : "!");
  const panel = document.querySelector(".status-section");
  if (panel) { panel.classList.remove("status-success","status-error"); panel.classList.add(success ? "status-success" : "status-error"); }
}
function setBusy(value) {
  busy = value;
  ["connectWallet","checkAccount","refreshBalance","createAccount","deposit","withdraw","transfer"].forEach(id => { if ($(id)) $(id).disabled = value; });
}
function setConnectedUI(connected) {
  setText("connectionStatus", connected ? "Wallet Connected" : "Wallet Disconnected");
}
function setAccountStatus(status) {
  setText("accountStatus", status); setText("summaryAccountStatus", status);
  const badge = $("accountStatusBadge"), dot = $("summaryStatusDot");
  if (badge) { badge.classList.remove("is-active","is-error"); if (status === "Active") badge.classList.add("is-active"); if (["Account Not Created","Unable to load"].includes(status)) badge.classList.add("is-error"); }
  if (dot) dot.classList.toggle("is-active", status === "Active");
}
function getErrorMessage(error) {
  const m = error?.data?.message || error?.cause?.message || error?.message || "An unknown error occurred.";
  if (/User denied|user rejected|ACTION_REJECTED/i.test(m)) return "You rejected the transaction in MetaMask.";
  if (/insufficient funds/i.test(m)) return "Your wallet does not have enough ETH to cover the amount and gas fees.";
  if (/Account already exist/i.test(m)) return "A bank account already exists for this wallet.";
  if (/Not the account owner/i.test(m)) return "Create a bank account for this wallet first.";
  if (/Recipient account does not exist/i.test(m)) return "The recipient must create a DecentraBank account first.";
  if (/Insufficient balance/i.test(m)) return "Your internal bank balance is insufficient for this transaction.";
  if (/Invalid address/i.test(m)) return "Enter a valid recipient wallet address.";
  return m.replace(/^Error:\\s*/,"").slice(0,240);
}
async function syncWallet(requestAccess = true) {
  if (!window.ethereum) throw new Error("MetaMask was not detected. Install the MetaMask browser extension.");
  web3 = new Web3(window.ethereum);
  const accounts = await window.ethereum.request({method: requestAccess ? "eth_requestAccounts" : "eth_accounts"});
  if (!accounts || !accounts.length) throw new Error("Connect your MetaMask wallet first.");
  currentAccount = accounts[0]; contract = new web3.eth.Contract(abi, contractAddress);
  setConnectedUI(true); setText("walletAddress", shortAddress(currentAccount)); setText("accountAddress", currentAccount);
  return currentAccount;
}
async function ensureWallet() {
  if (!window.ethereum) throw new Error("Please install MetaMask before using DecentraBank.");
  if (!web3 || !contract || !currentAccount) await syncWallet(true);
  const accounts = await window.ethereum.request({method:"eth_accounts"});
  if (!accounts || !accounts.length) throw new Error("Connect your MetaMask wallet first.");
  if (accounts[0].toLowerCase() !== currentAccount.toLowerCase()) {
    currentAccount = accounts[0]; contract = new web3.eth.Contract(abi, contractAddress);
    setText("walletAddress", shortAddress(currentAccount)); setText("accountAddress", currentAccount);
  }
  return currentAccount;
}
async function accountExists(address = currentAccount) {
  if (!contract || !address) return false;
  return await contract.methods.accountExists(address).call();
}
function readAmount(id) {
  const value = $(id)?.value?.trim();
  if (!value || !Number.isFinite(Number(value)) || Number(value) <= 0) throw new Error("Enter an amount greater than zero.");
  try { return web3.utils.toWei(value, "ether"); }
  catch { throw new Error("Enter a valid ETH amount with no more than 18 decimal places."); }
}
async function updateBalance() {
  try {
    await ensureWallet(); setText("accountAddress", currentAccount);
    if (!(await accountExists(currentAccount))) {
      setText("balance","0.0000"); setText("accountBalance","0.0000"); setAccountStatus("Account Not Created");
      showStatus("Bank account not found","Create an account for this wallet before depositing, withdrawing or transferring funds.",false); return;
    }
    const wei = await contract.methods.getBalance().call({from:currentAccount});
    const ether = web3.utils.fromWei(wei.toString(),"ether"), formatted = Number(ether).toFixed(4);
    setText("balance",formatted); setText("accountBalance",formatted); setAccountStatus("Active");
    showStatus("Account information updated",`Your account is active. Internal balance: ${ether} ETH.`,true);
  } catch (e) { console.error(e); setAccountStatus("Unable to load"); showStatus("Unable to get account information",getErrorMessage(e),false); }
}
async function createBankAccount() {
  if (busy) return;
  try {
    setBusy(true); await ensureWallet();
    if (await accountExists(currentAccount)) { showStatus("Account already exists","This wallet already has a DecentraBank account.",false); await updateBalance(); return; }
    showStatus("Waiting for confirmation","Confirm account creation in MetaMask.",true);
    await contract.methods.createAccount().send({from:currentAccount});
    showStatus("Account created successfully","Your DecentraBank account is ready to use.",true); await updateBalance();
  } catch(e) { console.error(e); showStatus("Account creation failed",getErrorMessage(e),false); }
  finally { setBusy(false); }
}
async function depositFunds() {
  if (busy) return;
  try {
    setBusy(true); await ensureWallet();
    if (!(await accountExists(currentAccount))) throw new Error("Not the account owner. Create your bank account first.");
    const amount = readAmount("depositAmount");
    showStatus("Waiting for deposit confirmation","Confirm the deposit transaction and gas fee in MetaMask.",true);
    await contract.methods.deposite().send({from:currentAccount,value:amount});
    $("depositAmount").value = ""; showStatus("Deposit successful","Your ETH deposit has been recorded in your internal bank balance.",true); await updateBalance();
  } catch(e) { console.error(e); showStatus("Deposit failed",getErrorMessage(e),false); }
  finally { setBusy(false); }
}
async function withdrawFunds() {
  if (busy) return;
  try {
    setBusy(true); await ensureWallet();
    if (!(await accountExists(currentAccount))) throw new Error("Not the account owner. Create your bank account first.");
    const amount = readAmount("withdrawAmount");
    showStatus("Waiting for withdrawal confirmation","Confirm the withdrawal transaction in MetaMask.",true);
    await contract.methods.withdraw(amount).send({from:currentAccount});
    $("withdrawAmount").value = ""; showStatus("Withdrawal successful","The withdrawn ETH has been sent back to your wallet.",true); await updateBalance();
  } catch(e) { console.error(e); showStatus("Withdrawal failed",getErrorMessage(e),false); }
  finally { setBusy(false); }
}
async function transferFunds() {
  if (busy) return;
  try {
    setBusy(true); await ensureWallet();
    if (!(await accountExists(currentAccount))) throw new Error("Not the account owner. Create your bank account first.");
    const recipient = $("toAddress").value.trim();
    if (!web3.utils.isAddress(recipient)) throw new Error("Invalid address");
    if (recipient.toLowerCase() === currentAccount.toLowerCase()) throw new Error("You cannot transfer funds to your own address.");
    if (!(await accountExists(recipient))) throw new Error("Recipient account does not exist");
    const amount = readAmount("transferAmount");
    showStatus("Waiting for transfer confirmation","Confirm the internal balance transfer in MetaMask.",true);
    await contract.methods.transfer(recipient,amount).send({from:currentAccount});
    $("transferAmount").value = ""; $("toAddress").value = "";
    showStatus("Transfer successful","The recipient's internal bank balance has been updated.",true); await updateBalance();
  } catch(e) { console.error(e); showStatus("Transfer failed",getErrorMessage(e),false); }
  finally { setBusy(false); }
}
function registerEvents() {
  $("connectWallet")?.addEventListener("click",async()=>{try{await syncWallet(true);await updateBalance();}catch(e){showStatus("Wallet connection failed",getErrorMessage(e),false);}});
  $("checkAccount")?.addEventListener("click",updateBalance);
  $("refreshBalance")?.addEventListener("click",updateBalance);
  $("createAccount")?.addEventListener("click",createBankAccount);
  $("deposit")?.addEventListener("click",depositFunds);
  $("withdraw")?.addEventListener("click",withdrawFunds);
  $("transfer")?.addEventListener("click",transferFunds);
  $("mobileMenu")?.addEventListener("click",()=>$("sidebar")?.classList.toggle("sidebar-open"));
  document.querySelectorAll(".nav-link").forEach(link=>link.addEventListener("click",()=>{
    document.querySelectorAll(".nav-link").forEach(n=>n.classList.remove("active"));link.classList.add("active");$("sidebar")?.classList.remove("sidebar-open");
  }));
  if (window.ethereum) {
    window.ethereum.on("accountsChanged",async accounts=>{
      if (!accounts || !accounts.length) {
        currentAccount=null;contract=null;setConnectedUI(false);setText("walletAddress","Connect MetaMask to continue");
        setText("accountAddress","Not connected");setText("balance","0.0000");setText("accountBalance","0.0000");setAccountStatus("Not connected");
        showStatus("Wallet disconnected","Reconnect MetaMask to continue.",false);return;
      }
      web3=new Web3(window.ethereum);currentAccount=accounts[0];contract=new web3.eth.Contract(abi,contractAddress);
      setConnectedUI(true);setText("walletAddress",shortAddress(currentAccount));setText("accountAddress",currentAccount);await updateBalance();
    });
    window.ethereum.on("chainChanged",()=>window.location.reload());
  }
}
document.addEventListener("DOMContentLoaded",()=>{
  registerEvents();
  if (!window.ethereum) {showStatus("MetaMask not detected","Install the MetaMask browser extension, then reload this page.",false);return;}
  syncWallet(false).then(()=>updateBalance()).catch(e=>{console.info("No wallet connected yet:",e.message);setConnectedUI(false);});
});

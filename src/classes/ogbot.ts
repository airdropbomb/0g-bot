import chalk from "chalk";
import { ethers, FetchRequest } from "ethers";
import { logMessage } from "../utils/logger";
import { getProxyAgent } from "./proxy";
const { setTimeout } = require("timers/promises");

import { BTC_ABI, ETH_ABI, ROUTER_ABI, USDT_ABI } from "../config/abi";
const RPC_ENDPOINTS = ["https://evmrpc-testnet.0g.ai"];

export class ogBot {
  private privkey: string;
  private address: string;
  private currentRpcIndex: number;
  private web3: any;
  private routerAddress: string;
  private routerAbi: any;
  private usdtAddress: string;
  private ethAddress: string;
  private btcAddress: string;
  private usdtAbi: any;
  private ethAbi: any;
  private btcAbi: any;
  private proxy: string | null;
  private currentNum: number;
  private total: number;


  constructor(privkey: string, proxy: string | null = null, currentNum: number, total: number) {
    this.privkey = privkey;
    this.address = new ethers.Wallet(this.privkey).address;
    this.currentRpcIndex = 0;
    this.web3 = this.initializeWeb3();
    this.routerAddress = "0xb95b5953ff8ee5d5d9818cdbefe363ff2191318c";
    this.routerAbi = ROUTER_ABI;
    this.usdtAddress = ethers.getAddress(
      "0x3ec8a8705be1d5ca90066b37ba62c4183b024ebf"
    );
    this.ethAddress = ethers.getAddress(
      "0x0fe9b43625fa7edd663adcec0728dd635e4abf7c"
    );
    this.btcAddress = ethers.getAddress(
      "0x36f6414ff1df609214ddaba71c84f18bcf00f67d");
    this.usdtAbi = USDT_ABI;
    this.ethAbi = ETH_ABI;
    this.btcAbi = BTC_ABI;
    this.currentNum = currentNum;
    this.total = total
    this.proxy = proxy;
  }

  private initializeWeb3() {
    const currentRpc = RPC_ENDPOINTS[this.currentRpcIndex];

    if (this.proxy) {
      FetchRequest.registerGetUrl(
        FetchRequest.createGetUrlFunc({
          agent: getProxyAgent(this.proxy, this.currentNum, this.total),
        })
      );
      return new ethers.JsonRpcProvider(currentRpc);
    }
    return new ethers.JsonRpcProvider(currentRpc);
  }

  switchRpc() {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % RPC_ENDPOINTS.length;
    logMessage(this.currentNum, this.total, `Switching to RPC endpoint: ${RPC_ENDPOINTS[this.currentRpcIndex]}`, "success");
    this.web3 = this.initializeWeb3();
  }

  handleTransactionError(errorMessage: any) {
    const errorText = errorMessage.message || errorMessage.toString();
    if (errorText.toLowerCase().includes("mempool is full")) {
      logMessage(this.currentNum, this.total, "Mempool is full, retrying...", "warning");
      this.switchRpc();
      return true;
    }

    return false;
  }

  async swapUsdtToEth(amountIn: any | ethers.Overrides): Promise<{ status: string; transactionHash?: string; amountIn?: string; message?: string }> {
    try {
      const wallet = new ethers.Wallet(this.privkey, this.web3);
      const usdtContract = new ethers.Contract(
        this.usdtAddress,
        this.usdtAbi,
        wallet
      );
      const routerContract = new ethers.Contract(
        this.routerAddress,
        this.routerAbi,
        wallet
      );

      const nonce = await this.web3.getTransactionCount(
        this.address,
        "pending"
      );
      logMessage(this.currentNum, this.total, `Using nonce ${nonce} for aprroval USDT`, "debug");

      const approveTx = await usdtContract.approve(
        this.routerAddress,
        amountIn,
        {
          nonce,
          gasLimit: 100000,
          gasPrice: (await this.web3.getFeeData()).gasPrice,
        }
      );

      await approveTx.wait();
      await setTimeout(5000);

      const swapNonce = await this.web3.getTransactionCount(
        this.address,
        "pending"
      );
      logMessage(this.currentNum, this.total, `Using nonce ${swapNonce} for swap USDT to ETH`, "debug");

      const deadline = Math.floor(Date.now() / 1000) + 300;
      const swapTx = await routerContract.exactInputSingle(
        {
          tokenIn: this.usdtAddress,
          tokenOut: this.ethAddress,
          fee: 3000,
          recipient: this.address,
          deadline,
          amountIn,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        },
        {
          nonce: swapNonce,
          gasLimit: 300000,
          gasPrice: (await this.web3.getFeeData()).gasPrice,
        }
      );

      await swapTx.wait();
      return {
        status: "success",
        transactionHash: swapTx.hash,
        amountIn: amountIn.toString(),
      };
    } catch (error) {
      if (this.handleTransactionError(error)) {
        return this.swapUsdtToEth(amountIn);
      }
      return {
        status: "error",
        message: (error as any).message,
      };
    }
  }


  async swapEthToUsdt(amountIn: any | ethers.Overrides): Promise<{ status: string; transactionHash?: string; amountIn?: string; message?: string }> {
    try {
      const wallet = new ethers.Wallet(this.privkey, this.web3);
      const ethContract = new ethers.Contract(
        this.ethAddress,
        this.ethAbi,
        wallet
      );
      const routerContract = new ethers.Contract(
        this.routerAddress,
        this.routerAbi,
        wallet
      );

      const nonce = await this.web3.getTransactionCount(
        this.address,
        "pending"
      );
      logMessage(this.currentNum, this.total, `Using nonce ${nonce} for approval ETH`, "debug");
      const approveTx = await ethContract.approve(
        this.routerAddress,
        amountIn,
        {
          nonce,
          gasLimit: 100000,
          gasPrice: (await this.web3.getFeeData()).gasPrice,
        }
      );

      await approveTx.wait();
      await setTimeout(5000);

      const swapNonce = await this.web3.getTransactionCount(
        wallet.address,
        "pending"
      );
      logMessage(this.currentNum, this.total, `Using nonce ${swapNonce} for swap ETH to USDT`, "debug");
      const deadline = Math.floor(Date.now() / 1000) + 300;
      const swapTx = await routerContract.exactInputSingle(
        {
          tokenIn: this.ethAddress,
          tokenOut: this.usdtAddress,
          fee: 3000,
          recipient: this.address,
          deadline,
          amountIn,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        },
        {
          nonce: swapNonce,
          gasLimit: 500000,
          gasPrice: (await this.web3.getFeeData()).gasPrice,
        }
      );

      await swapTx.wait();
      return {
        status: "success",
        transactionHash: swapTx.hash,
        amountIn: amountIn.toString(),
      };
    } catch (error) {
      if (this.handleTransactionError(error)) {
        return this.swapEthToUsdt(amountIn);
      }
      return {
        status: "error",
        message: (error as any).message,
      };
    }
  }

  async processSwapUsdtEth() {
    const usdtDecimals = 18;
    const randomAmount = parseFloat(
      (Math.random() * (2 - 0.5) + 0.5).toFixed(2)
    );
    const amountToSwap = ethers.parseUnits(
      randomAmount.toString(),
      usdtDecimals
    );
    const currentTime = new Date().toLocaleString();
    logMessage(this.currentNum, this.total, `Transaction USDT/ETH started at ${currentTime}`, "success");
    const result = await this.swapUsdtToEth(amountToSwap);
    if (result.status === "success") {
      const txHash = result.transactionHash;
      logMessage(this.currentNum, this.total, `Status: ${result.status}`, "success");
      logMessage(this.currentNum, this.total, `Transaction Hash: ${txHash}`, "success");
      logMessage(this.currentNum, this.total, `Amount: ${randomAmount}`, "success");
      logMessage(this.currentNum, this.total, `Blockhash URL: https://chainscan-newton.0g.ai/tx/${txHash}`, "success");
      console.log(chalk.white("-".repeat(85)));
      await setTimeout(5000);
      const ethDecimals = 18;
      const randomEthAmount = parseFloat(
        (Math.random() * (0.0005 - 0.0002) + 0.0002).toFixed(6)
      );
      const ethAmountToSwap = ethers.parseUnits(
        randomEthAmount.toString(),
        ethDecimals
      );

      const resultBack = await this.swapEthToUsdt(ethAmountToSwap);
      if (resultBack.status === "success") {
        const txHashBack = resultBack.transactionHash;
        logMessage(this.currentNum, this.total, `Status: ${resultBack.status}`, "success");
        logMessage(this.currentNum, this.total, `Transaction Hash: ${txHashBack}`, "success");
        logMessage(this.currentNum, this.total, `Amount: ${randomEthAmount}`, "success");
        logMessage(this.currentNum, this.total, `BlockHash URL: https://chainscan-newton.0g.ai/tx/${txHashBack}`, "success");
        console.log(chalk.white("-".repeat(85)));
      } else {
        logMessage(this.currentNum, this.total, `Transaction  failed: ${resultBack.message}`, "error");
      }
    } else {
      logMessage(this.currentNum, this.total, `Transaction  failed: ${result.message}`, "error");
    }
  }

  async swapUsdtToBtc(amountIn: any | ethers.Overrides): Promise<{ status: string; transactionHash?: string; amountIn?: string; message?: string }> {
    try {
      const wallet = new ethers.Wallet(this.privkey, this.web3);
      const usdtContract = new ethers.Contract(
        this.usdtAddress,
        this.usdtAbi,
        wallet
      );
      const routerContract = new ethers.Contract(
        this.routerAddress,
        this.routerAbi,
        wallet
      );

      const nonce = await this.web3.getTransactionCount(
        this.address,
        "pending"
      );
      logMessage(this.currentNum, this.total, `Using nonce ${nonce} for aprroval USDT`, "debug");

      const approveTx = await usdtContract.approve(
        this.routerAddress,
        amountIn,
        {
          nonce,
          gasLimit: 100000,
          gasPrice: (await this.web3.getFeeData()).gasPrice,
        }
      );

      await approveTx.wait();
      await setTimeout(5000);

      const swapNonce = await this.web3.getTransactionCount(
        this.address,
        "pending"
      );
      logMessage(this.currentNum, this.total, `Using nonce ${swapNonce} for swap USDT to BTC`, "debug");

      const deadline = Math.floor(Date.now() / 1000) + 300;
      const swapTx = await routerContract.exactInputSingle(
        {
          tokenIn: this.usdtAddress,
          tokenOut: this.btcAddress,
          fee: 3000,
          recipient: this.address,
          deadline,
          amountIn,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        },
        {
          nonce: swapNonce,
          gasLimit: 300000,
          gasPrice: (await this.web3.getFeeData()).gasPrice,
        }
      );

      await swapTx.wait();
      return {
        status: "success",
        transactionHash: swapTx.hash,
        amountIn: amountIn.toString(),
      };
    } catch (error) {
      if (this.handleTransactionError(error)) {
        return this.swapUsdtToEth(amountIn);
      }
      return {
        status: "error",
        message: (error as any).message,
      };
    }
  }


  async swapBtcToUsdt(amountIn: any | ethers.Overrides): Promise<{ status: string; transactionHash?: string; amountIn?: string; message?: string }> {
    try {
      const wallet = new ethers.Wallet(this.privkey, this.web3);
      const ethContract = new ethers.Contract(
        this.btcAddress,
        this.btcAbi,
        wallet
      );
      const routerContract = new ethers.Contract(
        this.routerAddress,
        this.routerAbi,
        wallet
      );

      const nonce = await this.web3.getTransactionCount(
        this.address,
        "pending"
      );
      logMessage(this.currentNum, this.total, `Using nonce ${nonce} for approval BTC`, "debug");
      const approveTx = await ethContract.approve(
        this.routerAddress,
        amountIn,
        {
          nonce,
          gasLimit: 100000,
          gasPrice: (await this.web3.getFeeData()).gasPrice,
        }
      );

      await approveTx.wait();
      await setTimeout(5000);

      const swapNonce = await this.web3.getTransactionCount(
        wallet.address,
        "pending"
      );
      logMessage(this.currentNum, this.total, `Using nonce ${swapNonce} for swap BTC to USDT`, "debug");
      const deadline = Math.floor(Date.now() / 1000) + 300;
      const swapTx = await routerContract.exactInputSingle(
        {
          tokenIn: this.btcAddress,
          tokenOut: this.usdtAddress,
          fee: 3000,
          recipient: this.address,
          deadline,
          amountIn,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        },
        {
          nonce: swapNonce,
          gasLimit: 500000,
          gasPrice: (await this.web3.getFeeData()).gasPrice,
        }
      );

      await swapTx.wait();
      return {
        status: "success",
        transactionHash: swapTx.hash,
        amountIn: amountIn.toString(),
      };
    } catch (error) {
      if (this.handleTransactionError(error)) {
        return this.swapEthToUsdt(amountIn);
      }
      return {
        status: "error",
        message: (error as any).message,
      };
    }
  }

  async processSwapUsdtBtc() {
    const usdtDecimals = 6;
    const randomAmount = parseFloat(
      (Math.random() * (2 - 0.5) + 0.5).toFixed(2)
    );
    const amountToSwap = ethers.parseUnits(
      randomAmount.toString(),
      usdtDecimals
    );
    const currentTime = new Date().toLocaleString();
    logMessage(this.currentNum, this.total, `Transaction USDT/BTC started at ${currentTime}`, "success");
    const result = await this.swapUsdtToBtc(amountToSwap);
    if (result.status === "success") {
      const txHash = result.transactionHash;
      logMessage(this.currentNum, this.total, `Status: ${result.status}`, "success");
      logMessage(this.currentNum, this.total, `Transaction Hash: ${txHash},`, "success");
      logMessage(this.currentNum, this.total, `Amount: ${randomAmount}`, "success");
      logMessage(this.currentNum, this.total, `BlockHash URL: https://chainscan-newton.0g.ai/tx/${txHash}`, "success");
      console.log(chalk.white("-".repeat(85)));
      await setTimeout(5000);
      const btcDesimals = 8;
      const randomBtcAmount = parseFloat(
        (Math.random() * (0.0005 - 0.0002) + 0.0002).toFixed(6)
      );
      const btcAmountToSwap = ethers.parseUnits(
        randomBtcAmount.toString(),
        btcDesimals
      );

      const resultBack = await this.swapBtcToUsdt(btcAmountToSwap);
      if (resultBack.status === "success") {
        const txHashBack = resultBack.transactionHash;
        logMessage(this.currentNum, this.total, `Status: ${resultBack.status}`, "success");
        logMessage(this.currentNum, this.total, `Transaction Hash: ${txHashBack},`, "success");
        logMessage(this.currentNum, this.total, `Amount: ${randomBtcAmount}`, "success");
        logMessage(this.currentNum, this.total, `Blockhash URL: https://chainscan-newton.0g.ai/tx/${txHashBack}`, "success");
        console.log(chalk.white("-".repeat(85)));
      } else {
        logMessage(this.currentNum, this.total, `Transaction failed: ${resultBack.message}`, "error");
      }
    } else {
      logMessage(this.currentNum, this.total, `Transaction  failed: ${result.message}`, "error");
    }
  }


}

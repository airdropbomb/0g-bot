import chalk from "chalk";
import { ethers, FetchRequest } from "ethers";
import { logMessage } from "../utils/logger";
import { getProxyAgent } from "./proxy";
const { setTimeout } = require("timers/promises");

import { BTC_ABI, ETH_ABI, ROUTER_ABI, USDT_ABI } from "../config/abi";
const RPC_ENDPOINT = "https://evmrpc-testnet.0g.ai"; // Single, faster RPC endpoint

export class ogBot {
  private privkey: string;
  private address: string;
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
    this.web3 = this.initializeWeb3();
    this.routerAddress = "0xD86b764618c6E3C078845BE3c3fCe50CE9535Da7";
    this.routerAbi = ROUTER_ABI;
    this.usdtAddress = ethers.getAddress("0x9A87C2412d500343c073E5Ae5394E3bE3874F76b");
    this.ethAddress = ethers.getAddress("0xce830D0905e0f7A9b300401729761579c5FB6bd6");
    this.btcAddress = ethers.getAddress("0x1e0d871472973c562650e991ed8006549f8cbefc");
    this.usdtAbi = USDT_ABI;
    this.ethAbi = ETH_ABI;
    this.btcAbi = BTC_ABI;
    this.currentNum = currentNum;
    this.total = total;
    this.proxy = proxy;
  }

  private initializeWeb3() {
    if (this.proxy) {
      FetchRequest.registerGetUrl(
        FetchRequest.createGetUrlFunc({
          agent: getProxyAgent(this.proxy, this.currentNum, this.total),
        })
      );
      return new ethers.JsonRpcProvider(RPC_ENDPOINT);
    }
    return new ethers.JsonRpcProvider(RPC_ENDPOINT);
  }

  async swapUsdtToEth(amountIn: any | ethers.Overrides): Promise<{ status: string; transactionHash?: string; amountIn?: string; message?: string }> {
    try {
      const wallet = new ethers.Wallet(this.privkey, this.web3);
      const usdtContract = new ethers.Contract(this.usdtAddress, this.usdtAbi, wallet);
      const routerContract = new ethers.Contract(this.routerAddress, this.routerAbi, wallet);

      logMessage(this.currentNum, this.total, "Approving USDT", "debug");
      const approveTx = await usdtContract.approve(this.routerAddress, amountIn, {
        gasLimit: 100000,
        gasPrice: ethers.parseUnits("20", "gwei"), // Fixed 20 Gwei
      });

      await approveTx.wait();
      await setTimeout(5000); // Keeping delay as requested

      logMessage(this.currentNum, this.total, "Swapping USDT to ETH", "debug");
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
          gasLimit: 300000,
          gasPrice: ethers.parseUnits("20", "gwei"), // Fixed 20 Gwei
        }
      );

      await swapTx.wait();
      return {
        status: "success",
        transactionHash: swapTx.hash,
        amountIn: amountIn.toString(),
      };
    } catch (error) {
      return {
        status: "error",
        message: (error as any).message,
      };
    }
  }

  async swapEthToUsdt(amountIn: any | ethers.Overrides): Promise<{ status: string; transactionHash?: string; amountIn?: string; message?: string }> {
    try {
      const wallet = new ethers.Wallet(this.privkey, this.web3);
      const ethContract = new ethers.Contract(this.ethAddress, this.ethAbi, wallet);
      const routerContract = new ethers.Contract(this.routerAddress, this.routerAbi, wallet);

      logMessage(this.currentNum, this.total, "Approving ETH", "debug");
      const approveTx = await ethContract.approve(this.routerAddress, amountIn, {
        gasLimit: 100000,
        gasPrice: ethers.parseUnits("20", "gwei"), // Fixed 20 Gwei
      });

      await approveTx.wait();
      await setTimeout(5000); // Keeping delay as requested

      logMessage(this.currentNum, this.total, "Swapping ETH to USDT", "debug");
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
          gasLimit: 500000,
          gasPrice: ethers.parseUnits("20", "gwei"), // Fixed 20 Gwei
        }
      );

      await swapTx.wait();
      return {
        status: "success",
        transactionHash: swapTx.hash,
        amountIn: amountIn.toString(),
      };
    } catch (error) {
      return {
        status: "error",
        message: (error as any).message,
      };
    }
  }

  async processSwapUsdtEth() {
    const usdtDecimals = 18;
    const randomAmount = parseFloat((Math.random() * (2 - 0.5) + 0.5).toFixed(2));
    const amountToSwap = ethers.parseUnits(randomAmount.toString(), usdtDecimals);
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
      await setTimeout(5000); // Keeping delay as requested

      const ethDecimals = 18;
      const randomEthAmount = parseFloat((Math.random() * (0.0005 - 0.0002) + 0.0002).toFixed(6));
      const ethAmountToSwap = ethers.parseUnits(randomEthAmount.toString(), ethDecimals);

      const resultBack = await this.swapEthToUsdt(ethAmountToSwap);
      if (resultBack.status === "success") {
        const txHashBack = resultBack.transactionHash;
        logMessage(this.currentNum, this.total, `Status: ${resultBack.status}`, "success");
        logMessage(this.currentNum, this.total, `Transaction Hash: ${txHashBack}`, "success");
        logMessage(this.currentNum, this.total, `Amount: ${randomEthAmount}`, "success");
        logMessage(this.currentNum, this.total, `BlockHash URL: https://chainscan-newton.0g.ai/tx/${txHashBack}`, "success");
        console.log(chalk.white("-".repeat(85)));
      } else {
        logMessage(this.currentNum, this.total, `Transaction failed: ${resultBack.message}`, "error");
      }
    } else {
      logMessage(this.currentNum, this.total, `Transaction failed: ${result.message}`, "error");
    }
  }

  async swapUsdtToBtc(amountIn: any | ethers.Overrides): Promise<{ status: string; transactionHash?: string; amountIn?: string; message?: string }> {
    try {
      const wallet = new ethers.Wallet(this.privkey, this.web3);
      const usdtContract = new ethers.Contract(this.usdtAddress, this.usdtAbi, wallet);
      const routerContract = new ethers.Contract(this.routerAddress, this.routerAbi, wallet);

      logMessage(this.currentNum, this.total, "Approving USDT", "debug");
      const approveTx = await usdtContract.approve(this.routerAddress, amountIn, {
        gasLimit: 100000,
        gasPrice: ethers.parseUnits("20", "gwei"), // Fixed 20 Gwei
      });

      await approveTx.wait();
      await setTimeout(5000); // Keeping delay as requested

      logMessage(this.currentNum, this.total, "Swapping USDT to BTC", "debug");
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
          gasLimit: 300000,
          gasPrice: ethers.parseUnits("20", "gwei"), // Fixed 20 Gwei
        }
      );

      await swapTx.wait();
      return {
        status: "success",
        transactionHash: swapTx.hash,
        amountIn: amountIn.toString(),
      };
    } catch (error) {
      return {
        status: "error",
        message: (error as any).message,
      };
    }
  }

  async swapBtcToUsdt(amountIn: any | ethers.Overrides): Promise<{ status: string; transactionHash?: string; amountIn?: string; message?: string }> {
    try {
      const wallet = new ethers.Wallet(this.privkey, this.web3);
      const btcContract = new ethers.Contract(this.btcAddress, this.btcAbi, wallet);
      const routerContract = new ethers.Contract(this.routerAddress, this.routerAbi, wallet);

      logMessage(this.currentNum, this.total, "Approving BTC", "debug");
      const approveTx = await btcContract.approve(this.routerAddress, amountIn, {
        gasLimit: 100000,
        gasPrice: ethers.parseUnits("20", "gwei"), // Fixed 20 Gwei
      });

      await approveTx.wait();
      await setTimeout(5000); // Keeping delay as requested

      logMessage(this.currentNum, this.total, "Swapping BTC to USDT", "debug");
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
          gasLimit: 500000,
          gasPrice: ethers.parseUnits("20", "gwei"), // Fixed 20 Gwei
        }
      );

      await swapTx.wait();
      return {
        status: "success",
        transactionHash: swapTx.hash,
        amountIn: amountIn.toString(),
      };
    } catch (error) {
      return {
        status: "error",
        message: (error as any).message,
      };
    }
  }

  async processSwapUsdtBtc() {
    const usdtDecimals = 6;
    const randomAmount = parseFloat((Math.random() * (2 - 0.5) + 0.5).toFixed(2));
    const amountToSwap = ethers.parseUnits(randomAmount.toString(), usdtDecimals);
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
      await setTimeout(5000); // Keeping delay as requested

      const btcDecimals = 8;
      const randomBtcAmount = parseFloat((Math.random() * (0.0005 - 0.0002) + 0.0002).toFixed(6));
      const btcAmountToSwap = ethers.parseUnits(randomBtcAmount.toString(), btcDecimals);

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
      logMessage(this.currentNum, this.total, `Transaction failed: ${result.message}`, "error");
    }
  }
}

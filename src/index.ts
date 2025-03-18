import chalk from "chalk";
import fs from "fs";
import { ogBot } from "./classes/ogbot";
import { getRandomProxy, loadProxies } from "./classes/proxy";
import { logMessage, prompt } from "./utils/logger";

let totalTransactionGlobal: number | null = null;

async function main(): Promise<void> {
  console.log(
    chalk.cyan(`
 █████╗ ██████╗ ██████╗     ███╗   ██╗ ██████╗ ██████╗ ███████╗
██╔══██╗██╔══██╗██╔══██╗    ████╗  ██║██╔═══██╗██╔══██╗██╔════╝
███████║██║  ██║██████╔╝    ██╔██╗ ██║██║   ██║██║  ██║█████╗  
██╔══██║██║  ██║██╔══██╗    ██║╚██╗██║██║   ██║██║  ██║██╔══╝  
██║  ██║██████╔╝██████╔╝    ██║ ╚████║╚██████╔╝██████╔╝███████╗
╚═╝  ╚═╝╚═════╝ ╚═════╝     ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝
  By : ADB Node
 Use it at your own risk
  `)
  );

  if (totalTransactionGlobal === null) {
    const totalTransactionInput = parseInt(await prompt(chalk.yellow("Total transaction per day? ")));
    totalTransactionGlobal = totalTransactionInput;

    if (isNaN(totalTransactionGlobal) || totalTransactionGlobal <= 0) {
      console.log(chalk.red("Input not valid. Please input a number greater than 0."));
      process.exit(1);
    }
  }

  const accounts = fs
    .readFileSync("privatekey.txt", "utf8")
    .split("\n")
    .filter(Boolean);
  const count = accounts.length;

  const proxiesLoaded = loadProxies();
  if (!proxiesLoaded) {
    logMessage(null, null, "No Proxy. Using default IP", "debug");
  }

  let successful = 0;

  for (let i = 0; i < count; i++) {
    console.log(chalk.white("-".repeat(85)));
    logMessage(i + 1, count, "Processing Transaction", "debug");
    const privkey = accounts[i];
    const currentProxy = await getRandomProxy(i + 1, count);
    const og = new ogBot(privkey, currentProxy, i + 1, count);

    try {
      let txCount = 0;
      const transactionSequence = [
        og.processSwapUsdtBtc,
        og.processSwapUsdtEth,
        og.processSwapUsdtBtc,
        og.processSwapUsdtEth,
      ];

      while (txCount < totalTransactionGlobal) {
        let retries = 0;
        const maxRetries = 3; // Retry အကြိမ်အရေအတွက် သတ်မှတ်ထားတယ်
        let success = false;

        while (retries < maxRetries && !success) {
          try {
            logMessage(i + 1, count, `Total Transaction: ${txCount + 1}/${totalTransactionGlobal}`, "debug");
            await transactionSequence[txCount % transactionSequence.length].call(og);
            success = true; // Transaction အောင်မြင်ရင် success ဖြစ်မယ်
          } catch (err) {
            retries++;
            logMessage(i + 1, count, `Retry ${retries}/${maxRetries} failed: ${(err as any).message}`, "error");
            if (retries === maxRetries) {
              logMessage(i + 1, count, "Max retries reached for this transaction", "error");
              break; // Retry အကုန်လုံး fail ရင် ဒီ transaction ကို ရပ်မယ်
            }
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10 စက္ကန့် စောင့်ပြီး retry
          }
        }

        if (success) {
          txCount++; // Transaction အောင်မြင်ရင် txCount တိုးမယ်
        } else {
          break; // Retry အကုန်လုံး fail ရင် ဒီ account ကို ရပ်ပြီး နောက် account ကို သွားမယ်
        }
      }

      if (txCount === totalTransactionGlobal) {
        successful++; // အောင်မြင်တဲ့ account အရေအတွက် တိုးမယ်
      }
    } catch (err) {
      logMessage(i + 1, count, `Unexpected error: ${(err as any).message}`, "error");
    }
  }

  console.log(chalk.white("-".repeat(85)));
  if (successful > 0) {
    console.log(chalk.green(`Successfully processed ${successful}/${count} accounts`));
  } else {
    console.log(chalk.red("All transactions failed for all accounts"));
  }

  const now = new Date();
  const targetTime = new Date(now);
  targetTime.setHours(11, 0, 0, 0); // Log အရ 11:00:00 ကို သုံးထားတာကို ပြန်ညှိထားတယ်

  if (now > targetTime) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  const sleepTime = targetTime.getTime() - now.getTime();
  logMessage(null, null, `Sleeping until ${targetTime.toISOString()}...`, "success");
  await new Promise(resolve => setTimeout(resolve, sleepTime));

  main(); // နောက်တစ်ကြိမ် run ဖို့ recursive call
}

main().catch((err) => {
  console.error(chalk.red("Error occurred:"), err);
  process.exit(1);
});

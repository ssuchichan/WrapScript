import { createTestClient, encodeFunctionData, http, parseEther, parseGwei } from 'viem'
import { foundry } from 'viem/chains'
import { agencyABI } from './abi/agency'
 
const testClient = createTestClient({
  chain: foundry,
  mode: 'anvil',
  transport: http(), 
})
// await testClient.setBalance({
//   address: "0xef77a0ca468375180503155A0B40CD9006357BbE",
//   value: parseEther("100")
// })
// await testClient.setBalance({
//   address: "0x4e00243D892B1d6D23aa0Af84818559457fBC214",
//   value: parseEther("100")
// })
// await testClient.sendUnsignedTransaction({
//     from: "0x4e00243D892B1d6D23aa0Af84818559457fBC214",
//     to: "0xE9D0dc778cc6be88F905e80997Bf87dAdDAC4E20",
//     data: "0x2e8b5081000000000000000000000000c4d5dd95e04860140e0200e5b19b34eaa482fda6",
// })
await testClient.setBalance({
  address: "0xdd6Be8Ba35009FE5a67D973Ef7bA34a2Ee60C8fD",
  value: parseEther("100")
})
await testClient.sendUnsignedTransaction({
  from: "0xdd6Be8Ba35009FE5a67D973Ef7bA34a2Ee60C8fD",
  to: "0xd8b7F2e784e89b20E076553542D500db93aC67BD",
  data: "0x7a42557800000000000000000000000089eb45962e758e7603cfd843f1b563b97cb84da8"
})

import select from '@inquirer/select'
import { getDotAgencyEpochReward, getERC7527StakeData } from './utils/info';

const userSelect = await select({
    message: "WrapCoin Data",
    choices: [
        {
            name: "ERC7527 Token Stake Reward",
            value: "erc7527StakeReward",
            description: "Get the data of ERC7527 staking"
        },
        {
            name: "ERC7527 Stake Reward",
            value: "dotAgencyStakeReward",
            description: "Get the data of staking"
        }
    ]
})

switch (userSelect) {
    case "erc7527StakeReward":
        await getERC7527StakeData()
        break;
    case "dotAgencyStakeReward":
        await getDotAgencyEpochReward()
        break;
        
    default:
        break;
}
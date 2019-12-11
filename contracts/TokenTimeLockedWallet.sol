pragma solidity >= 0.4.18 < 0.6.0;

import "./ERC20.sol";
import "./SafeMath.sol";

contract TokenTimeLockedWallet {
    using SafeMath for uint;

    struct LockLevel {
        uint256 unlockTime;
        uint256 amount;
        bool isWithdraw;
    }

    address public creator;
    address public owner; //beneficiary
    uint256 public createdAt;
    uint constant MAX_TIME_STEP = 5*365*24*60*60; // 5 years

    LockLevel[] internal locks;

    // uint256[] public lockTimeFrames;
    // mapping(uint => uint) lockAmounts; // mapping lockTimeFrames to lockAmounts
    // mapping(uint => bool) withdraws;
    // uint256[] public lockAmounts;
    // uint256 public unlockDate;

    modifier onlyOwner {
        require(msg.sender == owner, "Caller is not owner");
        _;
    }

    constructor(
        address _creator,
        address _owner,
        uint256[] memory _lockTimeFrames,
        uint256[] memory _lockAmounts
    ) public {
        // verify unlock time
        require(_lockTimeFrames.length > 0, "Invalid lock periods");
        require(_lockTimeFrames.length == _lockAmounts.length, "Unlock period and amount defined is not the same");

        creator = _creator;
        owner = _owner;
        createdAt = block.timestamp;

        for(uint idx = 0; idx < _lockTimeFrames.length; idx++) {
            // require(_lockTimeFrames[idx] > now, "Step could not be too long");
            locks.push(LockLevel(_lockTimeFrames[idx], _lockAmounts[idx], false));
        }

        

        // lockTimeFrames = _lockTimeFrames;
        // lockAmounts = _lockAmounts;
    }

    // keep all the ether sent to this address
    // function () external payable { 
    //     emit Received(msg.sender, msg.value);
    // }

    function addNewLock(uint _lockTimeFrame, uint _unlockAmount) public onlyOwner returns(bool){
        require(_lockTimeFrame < MAX_TIME_STEP, "Lock time could not be too long");

        locks.push(LockLevel(_lockTimeFrame, _unlockAmount, false));
        // lockTimeFrames.push(_lockTimeFrame);
        // lockAmounts.push(_unlockAmount);

        return true;
    }

    // callable by owner only, after specified time, only for Tokens implementing ERC20
    function withdrawTokens(address _tokenContract) public returns(bool) {
        require(_tokenContract != address(0), "Invalid token contract");

        // calculate amount token can withdraw
        for(uint idx = 0; idx < locks.length; idx++) {
            if(locks[idx].unlockTime < now && !locks[idx].isWithdraw) {
                ERC20 token = ERC20(_tokenContract);
                //now send all the token balance
                uint256 tokenBalance = token.balanceOf(address(this));
                uint256 desiredAmount = locks[idx].amount;
                uint256 withdrawToken = desiredAmount > tokenBalance?tokenBalance:desiredAmount;

                bool result = token.transfer(owner, withdrawToken);
                if(result) {
                    locks[idx].isWithdraw = true;
                    emit WithdrewTokens(_tokenContract, msg.sender, withdrawToken);
                }
            }
        }

        return true;
    }

    function info() public view returns(address, address, uint256, uint256[] memory, uint256[] memory, bool[] memory) {
        uint256 len = locks.length;
        uint256[] memory unlockTimeFrames = new uint256[](len);
        uint256[] memory unLockAmounts = new uint256[](len);
        bool[] memory isWithdraw = new bool[](len);
        for(uint idx = 0; idx < len; idx++) {
            unlockTimeFrames[idx] = locks[idx].unlockTime;
            unLockAmounts[idx] = locks[idx].amount;
            isWithdraw[idx] = locks[idx].isWithdraw;
        }

        return (creator, owner, createdAt, unlockTimeFrames, unLockAmounts, isWithdraw);
    }

    // function lockInfo() public view returns (uint256[] memory, uint256[] memory) {
    //     return (lockTimeFrames, lockAmounts);
    // }
    event WithdrewTokens(address tokenContract, address to, uint256 amount);
}

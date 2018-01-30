pragma solidity ^0.4.18;

import './zeppelin/math/SafeMath.sol';
import './zeppelin/math/Math.sol';
import './zeppelin/ownership/Ownable.sol';
import "./zeppelin/token/SafeERC20.sol";
import './FLOTToken.sol';

contract FLOTGameRound is Ownable {
    using SafeMath for uint256;    
    using SafeERC20 for FLOTToken;

    uint8 public constant MAIN_BET_SIZE = 5;            //How much numbers should player select for main bet
    uint8 public constant MAIN_BET_VARIANTS = 49;       //How many numbers are in main block
    uint8 public constant BONUS_BET_VARIANTS = 21;      //How many numbers are in bonus block

    struct Bet {
        uint8[5/*MAIN_BET_SIZE*/] mainBet;              //Array of numbers from 1 to MAIN_BET_VARIANTS (inclusive)
        uint8 bonusBet;                                 //A number from 1 to BONUS_BET_VARIANTS (inclusive)
    }
    struct Ticket {
        address player;                                 //Who send this bet
        uint256 amount;                                 //Amount of tokens used to place bet
        Bet bet;        
    }

    uint256 public prizeFund;                           //Prize fund of this round (summ of all bought tickets + tokens from previous round)
    Ticket[] public tickets;                                    //Array of tickets
    Bet public winnerBet;

    enum WinType {None, W2B, W3, W3B, W4, W4B, W5, W5B}         //Type of te win represents how many numbers in a bet match a winner bet
    struct PrizeInfo {
        uint256 totalBetAmount;                             //summ of all winner tickets amounts
        Ticket[] winTikets;
        uint256 lastWinnerPaid;
    }
    mapping(uint8 => PrizeInfo) winners;                         //Mapping of WinType to a PrizeInfon struct with an array of found winner tickets
    uint256 public lastCheckedTicket;                           //As calculatePrizes() is iterative process, here we save last checked bet index

    uint64 public startTimestamp;                       //Round start timestamp
    uint64 public endTimestamp;                         //Round end timestamp

    FLOTToken token;

    function FLOTGameRound(FLOTToken _token, uint64 _startTimestamp, uint64 _endTimestamp) public {
        require(_startTimestamp < _endTimestamp);
        //require(_startTimestamp >= now);           //do not require this because transaction mining may take more time then expected
        require(_endTimestamp > now);           
        
        token = _token;
        startTimestamp = _startTimestamp;
        endTimestamp = _endTimestamp;

        prizeFund = token.balanceOf(address(this));
    }

    //function() public {revert();} //We do not use fallback function


    function bet(uint256 amount, uint8[5/*MAIN_BET_SIZE*/] mainBet, uint8 bonusBet) public {
        bet(msg.sender, amount, mainBet, bonusBet);
    }

    function bet(address _player, uint256 _amount, uint8[5/*MAIN_BET_SIZE*/] _mainBet, uint8 _bonusBet) public {
        require(_amount > 0);
        requireBetCorrect(_mainBet, _bonusBet);
        token.safeTransferFrom(_player, address(this), _amount);
        tickets.push(
            Ticket({
                player: _player,
                amount: _amount,
                bet: Bet({mainBet:_mainBet, bonusBet:_bonusBet})
            })
        );
    }

    function setWinner(uint8[5/*MAIN_BET_SIZE*/] _mainBet, uint8 _bonusBet) onlyOwner public {
        requireBetCorrect(_mainBet, _bonusBet);
        //TODO Add conditions check
        winnerBet = Bet({mainBet:_mainBet, bonusBet:_bonusBet});
    }


    function findWinners(uint256 limit) onlyOwner public returns(uint256){
        require(winnerBet.bonusBet != 0);       //requires winner is set
        uint256 start = lastCheckedTicket;
        uint256 last = Math.min256(tickets.length, start+limit);
        require(last > start);
        for(uint256 i = start; i < last; i++){
            Ticket storage t = tickets[i];
            WinType w = getWinType(t.bet.mainBet, t.bet.bonusBet);
            if(w != WinType.None){
                PrizeInfo storage p = winners[uint8(w)];
                p.winTikets.push(t);
                p.totalBetAmount = p.totalBetAmount.add(t.amount);
            }
        }
        lastCheckedTicket = last - 1;
        return lastCheckedTicket;
    }

    function getWinnersBetAmount(WinType w) public returns(uint256){
        return winners[uint8(w)].totalBetAmount;
    }

    function sendPrizes(WinType w, uint256 totalPrizeAmount, uint256 limit) onlyOwner public returns(uint256){
        require(w != WinType.None);
        PrizeInfo storage p = winners[uint8(w)];
        uint256 start = p.lastWinnerPaid;
        uint256 last = Math.min256(p.winTikets.length, start+limit);
        uint256 winAmount = totalPrizeAmount.div(p.totalBetAmount);
        for(uint256 i=0; i < last; i++){
            Ticket storage t = p.winTikets[i];
            token.safeTransfer(t.player, winAmount);
        }
        p.lastWinnerPaid = last-1;
        return p.lastWinnerPaid;
    }


    function getWinType(uint8[5/*MAIN_BET_SIZE*/] mainBet, uint8 bonusBet) view internal returns(WinType){
        //require(winnerBet.bonusBet != 0);
        //requireBetCorrect(mainBet, bonusBet);     //Do not check condotions because they should already be checked

        uint8[5/*MAIN_BET_SIZE*/] storage winMainBet = winnerBet.mainBet;
        uint8 mainGuessed = 0;
        uint8 i = 0; uint8 j = 0;
        //see https://habrahabr.ru/post/250191/ for algorithm description
        while(i < MAIN_BET_SIZE && j < MAIN_BET_SIZE){
            if(mainBet[i] == winMainBet[j]){
                mainGuessed++;
                i++;
                j++;
            }else{
                if(mainBet[i] < winMainBet[j]){
                    i++;
                }else{
                    j++;
                }
            }
        }
        bool bonusGuessed = (bonusBet == winnerBet.bonusBet);
        if(mainGuessed == 2 && bonusGuessed){
            return WinType.W2B;
        }else if(mainGuessed == 3){
            return bonusGuessed?WinType.W3B:WinType.W3;
        }else if(mainGuessed == 3){
            return bonusGuessed?WinType.W3B:WinType.W3;
        }else if(mainGuessed == 4){
            return bonusGuessed?WinType.W4B:WinType.W4;
        }else if(mainGuessed == 5){
            return bonusGuessed?WinType.W5B:WinType.W5;
        }
        assert(mainGuessed < 2);
        return WinType.None;
    }

    function ticketCount() view public returns(uint256){
        return tickets.length;
    }

    function requireBetCorrect(uint8[5/*MAIN_BET_SIZE*/] _mainBet, uint8 _bonusBet) pure internal{
        require(_bonusBet > 0 && _bonusBet <= BONUS_BET_VARIANTS);
        uint8 prevNum = 0;
        for(uint8 i = 0; i < MAIN_BET_SIZE; i++){
            require(_mainBet[i] > prevNum);            //Require bet to be sorted from least to greatest numbers
            require(_mainBet[i] <= MAIN_BET_VARIANTS); 
            prevNum = _mainBet[i];  
        }
    }

    /**
    * @dev Transfers the current balance to the owner and terminates the contract.
    */
    function destroy() onlyOwner public {
        require(now > endTimestamp);        //Only allow destruct contract after game end
        //TODO add more conditions
        selfdestruct(owner);
    }
    /**
    * @dev Reclaim all ERC20Basic compatible tokens
    * @param _token ERC20Basic The address of the token contract
    */
    function reclaimToken(ERC20Basic _token) external onlyOwner {
        require(address(token) != address(_token)); //Do not allow to reclaim FLOT
        //TODO Allow to reclaim FLOT in emergency conditions
        uint256 balance = token.balanceOf(this);
        token.safeTransfer(owner, balance);
    }
}

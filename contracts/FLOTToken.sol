pragma solidity ^0.4.15;


import './zeppelin/token/MintableToken.sol';
import './zeppelin/ownership/NoOwner.sol';

contract FLOTToken is MintableToken, NoOwner { //MintableToken is StandardToken, Ownable
    string public symbol = 'FLOT';
    string public name = 'FLOT';
    uint8 public constant decimals = 18;

    address founder;    //founder address to allow him transfer tokens while minting
    function init(address _founder) onlyOwner public{
        founder = _founder;
    }

    /**
     * Allow transfer only after crowdsale finished
     */
    modifier canTransfer() {
        require(mintingFinished || msg.sender == founder);
        _;
    }
    
    function transfer(address _to, uint256 _value) canTransfer public returns (bool) {
        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint256 _value) canTransfer public returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }
}


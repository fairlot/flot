var $ = jQuery;
jQuery(document).ready(function($) {

    let web3 = null;
    let tokenContract = null;
    let crowdsaleContract = null;
    let referralCrowdsaleContract = null;


    setTimeout(init, 1000);

    async function init(){
        web3 = await loadWeb3();
        if(web3 == null) {
            setTimeout(init, 5000);
            return;
        }
        loadContract('./build/contracts/FLOTToken.json', function(data){
            tokenContract = data;
            $('#tokenABI').text(JSON.stringify(data.abi));
        });
        loadContract('./build/contracts/FLOTCrowdsale.json', function(data){
            crowdsaleContract = data;
            $('#crowdsaleABI').text(JSON.stringify(data.abi));
            initManageForm();
        });
        initCrowdsaleForm();
    }
    function initCrowdsaleForm(){
        let form = $('#publishContractsForm');
        setInterval(function(){$('#clock').val( (new Date()).toISOString() )}, 1000);
        let d = new Date();
        let nowTimestamp = d.setMinutes(0, 0, 0);
        d = new Date(nowTimestamp+1*60*60*1000);
        $('input[name=startTime]', form).val(d.toISOString());
        d = new Date(nowTimestamp+(30*24 + 1)*60*60*1000);
        $('input[name=endTime]', form).val(d.toISOString());
        $('input[name=rate]', form).val(4000);
        $('input[name=founderTokens]', form).val(50000000);
        $('input[name=goal]', form).val(100000000);
        $('input[name=hardCap]', form).val(250000000);

    }

    function initManageForm(){
        let crowdsaleAddress = getUrlParam('crowdsale');
        if(web3.utils.isAddress(crowdsaleAddress)){
            $('input[name=crowdsaleAddress]', '#manageCrowdsale').val(crowdsaleAddress);
            $('#loadCrowdsaleInfo').click();
        }
    }


    $('#publishCrowdsale').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#publishContractsForm');

        let startTimestamp = timeStringToTimestamp($('input[name=startTime]', form).val());
        let endTimestamp  = timeStringToTimestamp($('input[name=endTime]', form).val());
        let rate = $('input[name=rate]', form).val();
        let founderTokens  = web3.utils.toWei($('input[name=founderTokens]', form).val());
        let goal  = web3.utils.toWei($('input[name=goal]', form).val());
        let hardCap  = web3.utils.toWei($('input[name=hardCap]', form).val());
         
        let args = [startTimestamp, endTimestamp, rate, founderTokens, goal, hardCap];
        console.log('Publishing '+crowdsaleContract.contractName+' with arguments:', args);

        let crowdsaleObj = new web3.eth.Contract(crowdsaleContract.abi);
        crowdsaleObj.deploy({
            data: crowdsaleContract.bytecode,
            arguments: args
        })
        .send({
            from: web3.eth.defaultAccount,
        })
        .on('transactionHash',function(tx){
            $('input[name=publishedTx]',form).val(tx);
        })
        .on('receipt',function(receipt){
            let crowdsaleAddress = receipt.contractAddress;
            $('input[name=publishedAddress]',form).val(crowdsaleAddress);
            $('input[name=crowdsaleAddress]','#manageCrowdsale').val(crowdsaleAddress);
            $('#loadCrowdsaleInfo').click();
        })
        .then(function(contractInstance){
            contractInstance.methods.token().call().then(function(result){
                $('input[name=tokenAddress]',form).val(result);
            });
            return contractInstance;
        })
        .catch(function(error){
            if(error.message.indexOf('User denied transaction signature') != -1){
                printError('User rejected transaction');
                return;
            }
            console.log('Publishing failed: ', error);
            printError(error.message);
        });

    });


    $('#loadCrowdsaleInfo').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');

        let crowdsaleInstance = loadContractInstance(crowdsaleContract, $('input[name=crowdsaleAddress]',form).val());
        if(crowdsaleInstance == null) return;
        console.log('Loading info for contract at '+crowdsaleInstance.options.address);

        crowdsaleInstance.methods.token().call().then(function(result){
            $('input[name=tokenAddress]',form).val(result);
        });
        crowdsaleInstance.methods.startTimestamp().call().then(function(result){
            $('input[name=startTime]',form).val(timestmapToString(result));
        });
        crowdsaleInstance.methods.endTimestamp().call().then(function(result){
            $('input[name=endTime]',form).val(timestmapToString(result));
        });
        crowdsaleInstance.methods.crowdsaleOpen().call().then(function(result){
            $('input[name=open]',form).val(result?'yes':'no');
        });
        crowdsaleInstance.methods.rate().call().then(function(result){
            $('input[name=rate]',form).val(result);
        });
        crowdsaleInstance.methods.hardCap().call().then(function(result){
            $('input[name=hardCap]',form).val(web3.utils.fromWei(result));
        });
        crowdsaleInstance.methods.tokensSold().call().then(function(result){
            $('input[name=tokensSold]',form).val(web3.utils.fromWei(result));
        });
        crowdsaleInstance.methods.tokensMinted().call().then(function(result){
            $('input[name=tokensMinted]',form).val(web3.utils.fromWei(result));
        });
        crowdsaleInstance.methods.collectedEther().call().then(function(result){
            $('input[name=collectedEther]',form).val(web3.utils.fromWei(result));
        });
        web3.eth.getBalance(crowdsaleInstance.options.address).then(function(result){
            $('input[name=balance]',form).val(web3.utils.fromWei(result));
        });

    });

    $('#crowdsaleClaim').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');

        let crowdsaleInstance = loadContractInstance(crowdsaleContract, $('input[name=crowdsaleAddress]',form).val());
        if(crowdsaleInstance == null) return;

        crowdsaleInstance.methods.claimEther().send({
            from: web3.eth.defaultAccount,
        })
        .on('transactionHash', function(hash){
            console.log('Claim transaction tx: '+hash);
        })
        .then(function(receipt){
            console.log('Claim transaction mined: ', receipt);
            $('#loadCrowdsaleInfo').click();
            return receipt;
        });
    });

    $('#crowdsaleFinalize').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');

        let crowdsaleInstance = loadContractInstance(crowdsaleContract, $('input[name=crowdsaleAddress]',form).val());
        if(crowdsaleInstance == null) return;

        crowdsaleInstance.methods.finalizeCrowdsale().send({
            from: web3.eth.defaultAccount,
        })
        .on('transactionHash', function(hash){
            console.log('Finalize transaction tx: '+hash);
        })
        .then(function(receipt){
            console.log('Finalize transaction mined: ', receipt);
            $('#loadCrowdsaleInfo').click();
            return receipt;
        });
    });

    //====================================================

    async function loadWeb3(){
        printError('');
        if(typeof window.web3 == "undefined"){
            printError('No MetaMask found');
            return null;
        }
        // let Web3 = require('web3');
        // let web3 = new Web3();
        // web3.setProvider(window.web3.currentProvider);
        let web3 = new Web3(window.web3.currentProvider);

        let accounts = await web3.eth.getAccounts();
        if(typeof accounts[0] == 'undefined'){
            printError('Please, unlock MetaMask');
            return null;
        }
        // web3.eth.getBlock('latest', function(error, result){
        //     console.log('Current latest block: #'+result.number+' '+timestmapToString(result.timestamp), result);
        // });
        web3.eth.defaultAccount =  accounts[0];
        window.web3 = web3;
        return web3;
    }
    function loadContract(url, callback){
        $.ajax(url,{'dataType':'json', 'cache':'false', 'data':{'t':Date.now()}}).done(callback);
    }

    function loadContractInstance(contractDef, address){
        if(typeof contractDef == 'undefined' || contractDef == null) return null;
        if(!web3.utils.isAddress(address)){printError('Contract '+contractDef.contract_name+' address '+address+'is not an Ethereum address'); return null;}
        return new web3.eth.Contract(contractDef.abi, address);
    }

    function timeStringToTimestamp(str){
        return Math.round(Date.parse(str)/1000);
    }
    function timestmapToString(timestamp){
        return (new Date(timestamp*1000)).toISOString();
    }

    /**
    * Take GET parameter from current page URL
    */
    function getUrlParam(name){
        if(window.location.search == '') return null;
        let params = window.location.search.substr(1).split('&').map(function(item){return item.split("=").map(decodeURIComponent);});
        let found = params.find(function(item){return item[0] == name});
        return (typeof found == "undefined")?null:found[1];
    }

    function parseCSV(data){
        data = data.replace(/\t/g, ' ');
        let lineSeparator = '\n';
        let columnSeparator = ' ';
        let csv = data.trim().split(lineSeparator).map(function(line){
            return line.trim().split(columnSeparator).map(function(elem){
                return elem.trim();
            });
        });
        return csv;
    }
    function htmlEntities(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function printError(msg){
        if(msg == null || msg == ''){
            $('#errormsg').html('');    
        }else{
            console.error(msg);
            $('#errormsg').html(msg);
        }
    }
});

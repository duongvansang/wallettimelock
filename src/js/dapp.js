const NETWORK = {
    ROPSTEN:'https://ropsten.etherscan.io/',
    RINKEBY:'https://rinkeby.etherscan.io/',
    MAINNET:'https://etherscan.io/'
}

// default network is rinkeby
const defaultNetwork = 'RINKEBY';

const DApp = function () {
    this.factoryAddress = "0x4b1b145E23E783b83A0dD808bF9cd7C4EB270F4e";
    this.tokenAddress = "0xe880141c45D66A131c99DaCC88dbc32F85B454B2";
    this.tokenName = "MITx";
    this.network = NETWORK[defaultNetwork];

    this.MAX_STEP = 5;
    this.web3Provider;
    this.factoryContract;
    this.walletContract;
    this.tokenContract;
    this.currentAccount;
    this.table;
    this.wallets = [];
    this.development = false;
    this.DECIMAL = 18;
    this.baseToken = new BigNumber("10").exponentiatedBy(this.DECIMAL);
}

DApp.prototype.start = function () {
    console.log("[x] Initializing DApp.");
    this.initWeb3();
    this.initContract();
}

DApp.prototype.initWeb3 = async function() {
    // Is there is an injected web3 instance?
    if (typeof web3 !== 'undefined') {
      this.web3Provider = web3.currentProvider;
    } else {
      // If no injected web3 instance is detected, fallback to the TestRPC
      this.web3Provider = new Web3.providers.HttpProvider('http://localhost:9545');
    }
    web3 = new Web3(this.web3Provider);
    console.log("[x] web3 object initialized.");
}

DApp.prototype.getFactoryContract = function () {
    return this.development?this.factoryContract.deployed():this.factoryContract.at(this.factoryAddress);
}

DApp.prototype.getTokenContract = function () {
    return this.development?
        this.tokenContract.deployed():
        this.tokenContract.at(this.tokenAddress);
}

DApp.prototype.initContract = function () {
    $.getJSON('TimeLockedWalletFactory.json', (factoryContract) => {
        this.factoryContract = TruffleContract(factoryContract);
        this.factoryContract.setProvider(this.web3Provider);
        console.log("[x] TimeLockedWalletFactory contract initialized.");

        // ERC20 token contract
        $.getJSON('ERC20.json', (tokenContract) => {
            this.tokenContract = TruffleContract(tokenContract);
            this.tokenContract.setProvider(this.web3Provider);
            console.log("[x] ERC20Token contract initialized.");

            $.getJSON('TokenTimeLockedWallet.json', (walletContract) => {
                this.walletContract = TruffleContract(walletContract)
                this.walletContract.setProvider(this.web3Provider);
                console.log("[x] TimeLockedWallet contract initialized.");

                window.web3.eth.getAccounts((error, accounts) => {
                    if (error) {
                        console.error(error);
                    } else {
                        this.currentAccount = accounts[0];
                        console.log("[x] Using account", this.currentAccount);
                        this.initCreateWalletForm();
                        this.initTopupWalletForm();
                        this.initClaimForm();
                        this.prefillCreateWalletForm();
                        this.initTable();
                        this.loadWallets();
                    }
                });
            });
        });
    });
}

DApp.prototype.loadWallets = function () {
    if(this.development) {
        this.factoryContract.deployed()
            .then((factoryInstance) => {
                return factoryInstance.getWallets(this.currentAccount);
            })
            .then((walletAddresses) => {
                console.log("[x] Number of existing wallets:", walletAddresses.length);
                walletAddresses.forEach((wallet) => this.loadSingleWallet(wallet));
            });
    } else {
        this.factoryContract.at(this.factoryAddress)
            .then((factoryInstance) => {
                return factoryInstance.getWallets(this.currentAccount);
            })
            .then((walletAddresses) => {
                console.log("[x] Number of existing wallets:", walletAddresses.length);
                walletAddresses.forEach((wallet) => this.loadSingleWallet(wallet));
            });
    }
}

DApp.prototype.loadSingleWallet = function(walletAddress){
    this.walletContract.at(walletAddress)
    .then((walletInstance) => {
        return walletInstance.info();
    })
    .then((info) => {
        // console.log(info)
        let from        = info[0];
        let to          = info[1];
        let createdAt  = info[2].toNumber();
        let timeLocks = info[3];
        let amountLocks = info[4];
        let isWithdraws = info[5];

        console.log(`Loaded wallet ${walletAddress}`);
        console.log(`Creator ${from} for ${to}, created at ${createdAt}`);
        //
        this.addWalletToTable(from, to, walletAddress, createdAt, timeLocks, amountLocks, isWithdraws);
    });

    // Load Token wallets.
    this.getTokenContract()
        .then((tokenInstance) => {
            return tokenInstance.balanceOf(walletAddress);
        })
        .then((info) => {
            let amount = info.toString();
            this.addFundsToWallet(walletAddress, this.tokenName, amount);
        });
}

DApp.prototype.createNewWallet = function(receiverAddress, ethAmount, unlockDate) {
    if(this.development) {
        this.factoryContract.deployed()
            .then((factoryInstance) => {
                var tx = {
                    from: this.currentAccount,
                    value: 0
                };

                let inputAmounts = $("input[name=amount]");
                let inputDates = $("input[name=date]");
                let amounts = [];
                let timeLocks = [];

                for(let idx = 0; idx < inputAmounts.length; idx++) {
                    let amount = $(inputAmounts[idx]).val();
                    const parsed = parseInt(amount);
                    if (isNaN(parsed)) amounts.push(0);
                    amounts.push(this.baseToken.multipliedBy(parsed));
                }

                // console.log(amounts)
                for(let i = 0; i < inputDates.length; i++) {
                    let date = $(inputDates[i]).val();
                    let currentDate = new Date();

                    let unlockDate = moment(date, "MM/DD/YYYY").toDate();;
                    unlockDate.setHours(currentDate.getHours());
                    unlockDate.setMinutes(currentDate.getMinutes());


                    let timelock = unlockDate.getTime();
                    timelock = parseInt(timelock/1000);
                    timeLocks.push(timelock);
                }

                return factoryInstance.newTimeLockedWallet(receiverAddress, unlockDate, tx);
            })
            .then((tx) => {
                console.log(tx);
                let createdEvent = tx.logs[0].args;
                let from        = createdEvent.from;
                let to          = createdEvent.to;
                let walletAddress = createdEvent.wallet;
                let createdAt   = createdEvent.createdAt.toNumber();
                let timeLocks = createdEvent.timeLocks;
                let amountLocks = createdEvent.amountLocks;
                let isWithdraws = amountLocks.map(amountLocks => false);

                console.log(`Create wallet ${walletAddress}`);
                console.log(`Creator ${from} for ${to}, created at ${createdAt}`);
                //
                this.addWalletToTable(from, to, walletAddress, createdAt, timeLocks, amountLocks, isWithdraws);
            });
    } else {
        this.factoryContract.at(this.factoryAddress)
            .then((factoryInstance) => {
                let tx = {
                    from: this.currentAccount
                };

                let inputAmounts = $("input[name=amount]");
                let inputDates = $("input[name=date]");
                let amounts = [];
                let timeLocks = [];

                for(let idx = 0; idx < inputAmounts.length; idx++) {
                    let amount = $(inputAmounts[idx]).val();
                    const parsed = parseInt(amount);
                    if (isNaN(parsed)) amounts.push(0);
                    amounts.push(this.baseToken.multipliedBy(parsed).toFixed());
                }

                // console.log(amounts)
                for(let i = 0; i < inputDates.length; i++) {
                    let date = $(inputDates[i]).val();
                    let currentDate = new Date();

                    let unlockDate = moment(date, "MM/DD/YYYY").toDate();;
                    unlockDate.setHours(currentDate.getHours());
                    unlockDate.setMinutes(currentDate.getMinutes());


                    let timelock = unlockDate.getTime();
                    timelock = parseInt(timelock/1000);
                    timeLocks.push(timelock);
                }

                console.log(receiverAddress, timeLocks, amounts, tx)

                return factoryInstance.newTimeLockedWallet(receiverAddress, timeLocks, amounts, tx);
            })
            .then((tx) => {
                console.log(tx);
                let createdEvent = tx.logs[0].args;

                let from        = createdEvent.from;
                let to          = createdEvent.to;
                let walletAddress = createdEvent.wallet;
                let createdAt   = createdEvent.createdAt.toNumber();
                let timeLocks = createdEvent.lockTimeFrames;
                let amountLocks = createdEvent.lockAmounts;
                let isWithdraws = amountLocks.map(amount => false);

                console.log(createdEvent);

                console.log(`Create wallet ${walletAddress}`);
                console.log(`Creator ${from} for ${to}, created at ${createdAt}`);
                //
                this.addWalletToTable(from, to, walletAddress, createdAt, timeLocks, amountLocks,isWithdraws);
            });
    }
}

DApp.prototype.claimFunds = function(walletAddress, currency) {
    if(currency === "ether") {
        this.walletContract.at(walletAddress)
            .then((walletInstance) => {
                return walletInstance.withdraw({from: this.currentAccount});
            })
            .then((tx) => {
                let withdrawEvent = tx.logs[0].args;
                let amount = withdrawEvent["amount"].toNumber();
                this.addFundsToWallet(walletAddress, 'wei', (-1)*amount);
            });
    } else if (currency == "tokenerc20") {
        this.getTokenContract()
        .then((tokenInstance) => {
            console.log("ADDRESS", tokenInstance.address);
            this.walletContract.at(walletAddress)
                .then((walletInstance) => {
                    // walletInstance.withdrawTokens.estimateGas(); 
                    let gas = 200000;
                    return walletInstance.withdrawTokens(tokenInstance.address, {from: this.currentAccount, gas: gas});
                })
                .then((tx) => {
                    console.log(tx);
                    let withdrawEvent = tx.logs[0].args;
                    console.log("****", withdrawEvent["amount"].toString());
                    let amount = withdrawEvent["amount"].toString();
                    this.addFundsToWallet(walletAddress, this.tokenName, (-1)*amount);
                });
        })
    }
}

DApp.prototype.topupWallet = function(walletAddress, amount, currency) {
    if(currency === "ether") {
        console.log("Topup with plain old Ether");
        this.walletContract.at(walletAddress)
            .then((walletInstance) => {
                return walletInstance.send(web3.toWei(amount, "ether"), {from: this.currentAccount});
            })
            .then((tx) => {
                console.log(tx);
                createdEvent = tx.logs[0].args;
                var from   = createdEvent.from;
                var amount = createdEvent.amount.toString();

                this.addFundsToWallet(walletAddress, 'wei', amount);
            });
    } else if(currency === "tokenerc20") {
        console.log(`Topup ${this.tokenName} Token`);
        this.getTokenContract()
            .then((tokenInstance) => {
                let _amount = this.baseToken.multipliedBy(amount).toFixed(0);
                console.log(_amount);
                return tokenInstance.transfer(walletAddress, _amount, {from: this.currentAccount});
            })
            .then((tx) => {
                console.log(tx);
                transferEvent = tx.logs[0].args;
                var from = transferEvent.from;
                var amount = transferEvent.value.toString()

                this.addFundsToWallet(walletAddress, this.tokenName, amount);
            });
    } else {
        throw new Error("Unknown currency!");
    }
}

DApp.prototype.addFundsToWallet = function(walletAddress, token, amount){
    if(typeof this.wallets[walletAddress] == "undefined"){
        this.wallets[walletAddress] = {};
    }
    if(typeof this.wallets[walletAddress][token] == "undefined"){
        this.wallets[walletAddress][token] = 0;
    }
    // console.log(`Add ${amount} of ${token} to wallet`);
    this.wallets[walletAddress][token] = new BigNumber(this.wallets[walletAddress][token]).plus(amount);
    // DApp.wallets[walletAddress][token] += amount;

    //refresh doesn't work so using a workaround
    //DApp.table.bootstrapTable('refresh');
    this.table.bootstrapTable('updateRow', {index: 1000, row: null})
}

DApp.prototype.getKnownWalletBallance = function(walletAddress, token){
    if(typeof this.wallets[walletAddress] == "undefined") return 0;
    if(typeof this.wallets[walletAddress][token] == "undefined") return 0;
    let value = this.wallets[walletAddress][token];
    // console.log(walletAddress, token, value);
    return value;
}

DApp.prototype.initCreateWalletForm = function () {
    $('input.release-date').datepicker({
        uiLibrary: 'bootstrap4'
    });
    $("#create-wallet-form").submit((event) => {
        console.log("Create new wallet");
        event.preventDefault();
        var form = $(event.target);
        var ethAddress = form.find("#ethereumAddress").val();
        var ethAmount = form.find("#etherAmount").val();
        var unlockDate = new Date(form.find("#unlockDate").val()).getTime() / 1000;
        this.createNewWallet(ethAddress, ethAmount, unlockDate);
    });

    $("#addNewLock").click(function() {
        if($(".row",$("#create-wallet-form")).length > this.MAX_STEP) return;

        let row = $("<div>").addClass("row");
        let group = $("<div>").addClass("col form-group");
        // let amountLabel = $("<label>").value("Amount");
        let amountInput = $("<input>").addClass("form-control").attr("name","amount").attr("placeholder", "Amount to lock");

        let dateGroup = group.clone();
        // let dateLabel = amountLabel.clone().value("Release Date");
        let dateInput = amountInput.clone().attr("name","date").attr("placeholder", "MM/DD/YYYY");
        

        group.append(amountInput);
        dateGroup.append(dateInput);
        row.append(group);
        row.append(dateGroup);


        $(".container", $("#create-wallet-form")).append(row);

        dateInput.datepicker({
            uiLibrary: 'bootstrap4'
        });
    });
}

DApp.prototype.prefillCreateWalletForm = function(){
    $("#create-wallet-form #ethereumAddress").val(this.currentAccount);
    $("#create-wallet-form #etherAmount").val(0.0);
    let date = new Date();
    date.setMinutes(date.getMinutes() + 10);
    date = date.toISOString();
    date = date.slice(0, -8)
    $("#create-wallet-form #unlockDate").val(date);
}

DApp.prototype.initTopupWalletForm = function(){
    console.log("initTopupWalletForm");
    $("#topup-wallet-form").submit((event) => {
        event.preventDefault();
        let form = $(event.target);
        let targetWalletAddress = form.find('#knownWalletAddresses option').filter(":selected").val();
        let amount = form.find("#amount").val();
        let currency = form.find("#currency").val();
        console.log("[r] " + targetWalletAddress + "; " + amount + "; " + currency)
        this.topupWallet(targetWalletAddress, amount, currency);
    });
}

DApp.prototype.updateKnownWalletAddresses = function(walletAddress){
    // Add new address option to dropdown.
    $("#knownWalletAddresses").append("<option value='" + walletAddress + "'>" + walletAddress + "</option>");

    // Get rid of duplicate addresses
    var usedNames = {};
    $("select[id='knownWalletAddresses'] > option").each(function () {
        if(usedNames[this.text]) {
            $(this).remove();
        } else {
            usedNames[this.text] = this.value;
        }
    });
}

DApp.prototype.updateClaimWalletAddresses = function(walletAddress, to){
    //Only pick owned accounts
    console.log(walletAddress, to);
    if(this.currentAccount.toLowerCase() === to.toLowerCase()){
        // Add new address option to dropdown.
        $("#claimWalletAddresses").append("<option value='" + walletAddress + "'>" + walletAddress + "</option>");

        // Get rid of duplicate addresses
        var usedNames = {};
        $("select[id='claimWalletAddresses'] > option").each(function () {
            if(usedNames[this.text]) {
                $(this).remove();
            } else {
                usedNames[this.text] = this.value;
            }
        });
    }
}

DApp.prototype.updateClaimForm = function(){
    let form = $('#claim-funds-form');
    let wallet = $('#claimWalletAddresses').val();
    let currency = form.find("#claimableCurrency").val();
    if(currency == "tokenerc20") {
        let tokenValue = this.getKnownWalletBallance(wallet, this.tokenName)
        let tokenAmount = new BigNumber(`${tokenValue}`).div(this.baseToken).toNumber();
        form.find("#claimableAmount").val(tokenAmount);

        let unlocks = '';
        let timeLocks = this.wallets[wallet].timeLocks;
        let amountLocks = this.wallets[wallet].amountLocks;
        let isWithdraws = this.wallets[wallet].isWithdraws;

        timeLocks.forEach( (time, idx) => {
            let unLockAmout = new BigNumber(amountLocks[idx]).div(this.baseToken).toNumber();
            let ult = this.dateFormatter(time.toNumber());
            unlocks += `Unlock ${idx + 1}: ${ult}, ${unLockAmout} ${this.tokenName}s ${isWithdraws[idx]?'withdrawed':''}<br/>`;
        });
        // console.log(unlocks);
        $("#claimSchedule", form).html(unlocks);

    } else {
        console.log("Unknown currency set: " + currency);
    }

    //Update Unlock In
    this.table.bootstrapTable('getData').forEach(function(row) {
        if(row["wallet"] == wallet) {
            var unlockDate = row["unlockDate"];
            var now = Math.floor(Date.now() / 1000);
            // if(now >= unlockDate) {
            //     $("#unlockIn").val('OPEN');
            //     $("#claim-submit-button").prop('disabled', false);
            // } else {
            //     $("#unlockIn").val(DApp.dateFormatter(unlockDate));
            //     $("#claim-submit-button").prop('disabled', true);
            // }
        }
    });
}

DApp.prototype.initClaimForm = function(){
    console.log("initClaimForm");

    $('#claim-funds-form #claimWalletAddresses').change(this.updateClaimForm.bind(this));
    $('#claim-funds-form #claimableCurrency').change(this.updateClaimForm.bind(this));
    $('a[data-toggle="tab"]').on('shown.bs.tab', this.updateClaimForm.bind(this));

    $("#claim-funds-form").submit((event) => {
        event.preventDefault();
        var form = $(event.target);
        var walletAddress = form.find('#claimWalletAddresses option').filter(":selected").val();
        var currency = form.find("#claimableCurrency").val();

        this.claimFunds(walletAddress, currency);
    });
}

DApp.prototype.initTable = function() {
    this.table = $("#wallets-table");
    this.table.bootstrapTable({
        iconsPrefix: 'fa',
        icons: {
            // paginationSwitchDown: 'glyphicon-collapse-down icon-chevron-down',
            // paginationSwitchUp: 'glyphicon-collapse-up icon-chevron-up',
            // refresh: 'glyphicon-refresh icon-refresh',
            // toggle: 'glyphicon-list-alt icon-list-alt',
            // columns: 'glyphicon-th icon-th',
            detailOpen: 'fa-plus',
            detailClose: 'fa-minus'
        },
        detailView: true,
        detailFormatter: this.detailFormatter.bind(this),
        sortName: 'createdAt',
        sortOrder: 'desc',
        columns: [
            { 
                field: 'from', 
                title: 'From',
                formatter: this.hashFormatter.bind(this),
                searchable: true
            }, { 
                field: 'type',        
                title: 'Type',
                formatter: this.typeFormatter.bind(this),       
            },{ 
                field: 'to',
                title: 'Beneficiary',
                formatter: this.hashFormatter.bind(this),
            },{ 
                field: 'wallet',      
                title: 'Wallet',
                formatter: this.hashFormatter.bind(this),    
            },{ 
                field: 'createdAt',
                title: 'Age',
                formatter: this.dateFormatter.bind(this),
                sortable: true
            },{ 
                field: 'unlockDate',
                title: 'Unlock In',
                sortable: false
            },{ 
                field: 'value',
                title: "Wallet Balance",
                formatter: this.valueFormatter.bind(this),
                sortable: false
            },{ 
                field: 'actions',
                title: "Actions",
                formatter: this.actionFormatter.bind(this)
            }
        ],
    });
}

DApp.prototype.addWalletToTable = function(from, to, wallet, createdAt, timeLocks = [], amountLocks = [], isWithdraws = []){
    let unlocks = '';
    timeLocks.forEach( (time, idx) => {
        // console.log(`Wallet ${wallet}, unLocktime ${timeLocks[idx]}, unlockAmout ${amountLocks[idx]}`);
        let ult = this.dateFormatter(time.toNumber());
        let amount = new BigNumber(`${amountLocks[idx]}`).div(this.baseToken);
        unlocks += `Lock ${idx + 1}: ${ult}, ${amount} ${this.tokenName}s, ${isWithdraws[idx]?'withdrawed':''} <br/>`;
    });

    newRow = {
        type: this.discoverType(from, to),
        from: from,
        to: to,
        wallet, wallet,
        createdAt: createdAt,
        unlockDate: unlocks,
    }
    this.table.bootstrapTable('append', newRow);

    this.updateKnownWalletAddresses(wallet);
    this.updateClaimWalletAddresses(wallet, to);
    
    // this.wallets[wallet] = !this.wallets[wallet]?{}:this.wallets[wallet];
    this.wallets[wallet] = {...this.wallets[wallet],createdAt, timeLocks, amountLocks, isWithdraws};
}

DApp.prototype.discoverType = function(from, to){
    let _from = from;
    let _to = to;
    let currentAccount = this.currentAccount?this.currentAccount:'';
    _from = _from?_from: '';
    _to = _to?_to: '';
    _from = _from.toLowerCase();
    _to = _to.toLowerCase();
    currentAccount = currentAccount.toLowerCase()

    if(_from == _to && _from == currentAccount){
        return "self";
    } else if(_from == currentAccount){
        return "out";
    } else if(_to == currentAccount){
        return "in";
    } else {
        throw new Error("Unknown type!");
    }
}

DApp.prototype.typeFormatter = function(type){
    var badgeClass = {
        "self": "badge-info",
        "in":   "badge-success",
        "out":  "badge-warning"
    };

    return `<span class="badge ${badgeClass[type]}">${type}</span>`;
}

DApp.prototype.hashFormatter = function(hash, row, index){
    shortHash = hash.slice(0, 10);
    return `<a href="${this.network}/${hash}" target="_blank">${shortHash}...</a>`;
}

DApp.prototype.dateFormatter = function(timestamp, row, index){
    return moment(timestamp*1000).fromNow();
}

DApp.prototype.valueFormatter = function(cell, row){
    var weiValue = this.getKnownWalletBallance(row['wallet'], 'wei');
    var ethValue = web3.utils.fromWei(`${weiValue}`, 'ether');
    var tokenValue = this.getKnownWalletBallance(row['wallet'], this.tokenName)
    let tokenAmount = new BigNumber(`${tokenValue}`).div(this.baseToken).toNumber();

    // console.log("xxxx", row['wallet'], ethValue, toptalValue);

    if(ethValue == 0 && tokenAmount == 0){
        return 'Wallet empty';
    } 
    var html = '';
    if(ethValue > 0) { html += `${ethValue} Ether</br>`}
    if(tokenAmount > 0) { html += `${tokenAmount} ${this.tokenName}s`}

    return html;
}

DApp.prototype.detailFormatter = function(index, row){
    let table = $("<table></table");
    let options = {
        showHeader: false,
        columns: [
            { 
                field: 'key', 
                title: 'Key',
                cellStyle: this.detailViewKeyColumnFormatter
            }, { 
                field: 'value',        
                title: 'Value',
            }
        ],
        data: [
            {
                key: "From",
                value: row['from']
            }, {
                key: "Type",
                value: this.typeFormatter(row['type'])
            },{
                key: "To",
                value: row['to']
            },{
                key: "Wallet Address",
                value: row['wallet']
            },{
                key: "Age",
                value: () => this.dateFormatter(row['createdAt'])
            },{
                key: "Unlock In",
                value: row['unlockDate']
            },{
                key: "Value",
                value: () => this.valueFormatter(false, row)
            }
        ],
    }
    return table.bootstrapTable(options);
}

DApp.prototype.detailViewKeyColumnFormatter = function(value, row, index, field){
    return {
        classes: 'font-weight-bold',
    };
}

DApp.prototype.actionFormatter = function(value, row, index, field){
    var unlockDate = row["unlockDate"];
    var now = Math.floor(Date.now() / 1000);
    if(now >= unlockDate && row["to"] == this.currentAccount) {
        var html = `<button class="btn btn-danger" onClick="window.dApp.handleTopupButtonClick('${row['wallet']}')">Topup</button>` +
                `<button class="btn btn-warning text-white" onClick="window.dApp.handleClaimButtonClick('${row['wallet']}')">Claim</button>`;
    } else {
        var html = `<button class="btn btn-danger" onClick="window.dApp.handleTopupButtonClick('${row['wallet']}')">Topup</button>`;
    }
    return html;
}

DApp.prototype.handleTopupButtonClick = function(walletAddress){
    $('#knownWalletAddresses').val(walletAddress).change();
    $('#topup-tab').tab('show');
}

DApp.prototype.handleClaimButtonClick = function(walletAddress){
    $('#claimWalletAddresses').val(walletAddress).change();
    this.updateClaimForm();
    $('#claim-tab').tab('show');
}

$(function() {
    window.dApp = new DApp();
    dApp.start();
});

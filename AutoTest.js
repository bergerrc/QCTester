var qcApi = require("qc").create();
var fs = require('fs');
var hasProp = {}.hasOwnProperty;
var extend = require('extend');
var xls = require("xlsx");
var Promise = require("promise");

var AutoTest = function(){
	this.validator = undefined; //Step validator to be implemented
	this.options = {};
	this.defaultOpts = {
		server: undefined,
		port: 80,
		domain: undefined,
		project: undefined,
		user: undefined,
		password: undefined,
		defaultQuery: ["status['No Run']"],
		ignoreStepPassed: false,
		runs :[{
			package: null, //Name of the package (require) containing validator
			validator: null, //Normally this cant be null
			query: null,
			testId: null, //"e.g. 84001 //Fill the number of the testID to filter the test instances by TestPlan Id"
			testConfigId:null, //e.g 85871 //Fill the number of the testConfigID to filter the test instances by TestPlan Cenario
			testSetId: null, //e.g 15592 //Fill the number of the testSetID to filter the test instances by Test Set (Release/Cycle)
			testInstanceId: null, //"e.g 187561//Fill the number of the test Instance ID to filter the test in Test Lab. Cant be defined by code in QC screen, only by logs
			stepOrder: null, //e.g [1,2,3] //fill the step number that must be executed. Ordering not works here
			params: {}
		}],
		alwaysCreateRun: false,
		authCookie: null
	};

	this.translateCondition = function(text){
	  if (text!== null){
		 var i =  text.indexOf("igual a");
		 var me =  text.indexOf("menor que");
		 var meEq =  text.indexOf("menor ou igual a");
		 var ma =  text.indexOf("maior que");
		 var maEq =  text.indexOf("maior ou igual a");

		 if ( i >= 0 ) return text.replace("igual a", "==");
		 if ( me >= 0 ) return text.replace("menor que", "<");
		 if ( meEq >= 0 ) return text.replace("menor ou igual a", "<=");
		 if ( ma >= 0 ) return text.replace("maior que", ">");
		 if ( maEq >= 0 ) return text.replace("maior ou igual a", ">=");
	  }
	  return null;
	};
	
	this.fileShortName = function( f ){
	  var re = /[^\\]+$/i;
	  f.shortName = f.fileName.match(re);
	};
	
	this.createRun = function(params, order){
		var dateFormat = require('dateformat');
		var now = new Date();
		var id = dateFormat(now, "dd-mm_ss-MM-hh")+"_"+order;
		var result;	
		var pArr = [];
		var treatError = function(err) { 
			console.log("\x1b[0m","[ERROR] " + JSON.stringify(err)); 
		};
		
		pArr.push(qcApi.post('/runs',{data: {"type": "run",
								   "testcycl-id": t.id,
								   "cycle-id": t.cycleId,
								   "test-id": t.testId,
								   "subtype-id": "hp.qc.run.MANUAL",
								   "name": "Run_"+id,
								   "owner": this.options.user,
								   "status": "No Run",
									"comments": "Automated process"}} ).then(function(run){
										run["steps"] = [];
										run["params"] = params;
										queryArr = [];
										/*if ( iteration.stepOrder )
											queryArr.push( "step-order["+iteration.stepOrder.join(" OR ")+"]" );*/
										
										pArr.push(qcApi.get('/runs/'+run.id+'/run-steps', {"query": queryArr}).then(function(steps){
												steps.pop(); //Lista sempre vem com um step a mais por esta sendo removido 
												this.steps = steps;
										}.bind(run),function(err) { throw err; }));
										result = run;
		},function(err) { throw err; }) );
		Promise.all(pArr).then(function(resolved){
			Promise.all(pArr).then(function(resolved){
				return result;
			}.bind(this),treatError);
		}.bind(this),treatError);
	}
};

AutoTest.prototype.setOptions = function(opts){
	var fOpts = JSON.parse(fs.readFileSync('userconfig.json'));
	if ( typeof opts === 'string')
		opts = {runs: this.iterationsBySheet(opts)};
	extend(true, this.options, this.defaultOpts, fOpts, opts);
};

AutoTest.prototype.validateTest = function(testInstance, iteration, stepValidator){
	console.log(this.getLogColor(iteration.id), "Executando teste "+iteration.testConfig.name+"...");
    var p = this.validateRun(testInstance.run, iteration, stepValidator)	
	.then(function(result){		
		return qcApi.put( '/test-instances/'+this.id, {data: {"Type": "test-instance",
															   "id": this.id,
															   "status": result}} )
			.then(function(changedTest){
				console.log(AutoTest.prototype.getLogColor.call(iteration.id), "Teste=>"+changedTest.status);
				return Promise.resolve(changedTest.status);
			}.bind(this));
	}.bind(testInstance));
	return p;
};

AutoTest.prototype.validateRun = function(run, iteration, stepValidator){
	var continueExecution = true; 
	var paramsList = [];
	if ( run.params instanceof Array ){
		var paramsList = run.params;
		var firstParams = paramsList.splice(0,1);
		run.params = firstParams;
	}
	run.steps.forEach(function(step){
		step["run"] = this;
		step["attachments"] = [];
	}.bind(run));
	//Valida se os parametros requeridos foram preenchidos
	if( stepValidator.requiredParams ){
		var hasProps = true;
		var missing = [];
		for( p in stepValidator.requiredParams ){
			hasProps = run.params[p] !== undefined && hasProps;
			if (!hasProps) missing.push(p);
		}
		if (!hasProps){
			return Promise.reject("Required parameter(s) is/are missing: "+missing.join());
		}
	}
	//console.log(this.getLogColor(iteration.id), "Iteração "+run.name+".");
	/* TODO: Permitir executar varias vezes (multiplas Runs) com conjunto de parametros diferentes.
	paramsList.forEach(function(params,idx){
		var dynRun = this.createRun(params, idx);
		continueExecution = this.validateRun( dynRun, iteration, stepValidator) && continueExecution;
	});*/
	run.previousStatus = run.status;
	var p = this.validateSteps(run.steps, iteration, stepValidator)
	
	.then(function(result){
		if ( this.status != "Not Completed" && this.previousStatus != "Not Completed" )
			this.status = result? "Passed" : "Failed";
	}.bind(run))
	//Update Run's status in QC
	.then( function(run){
		var dateFormat = require('dateformat');
		var now = new Date();
		var execDate = dateFormat(now, "yyyy-mm-dd");
		var execTime = dateFormat(now, "hh:MM:ss");
		return qcApi.put( '/runs/'+run.id, {data: { "Type": "run",
											  "id": run.id,
											  "status": run.status,
											  "execution-time": execTime,
											  "execution-date": execDate}} )
			.then(function(changedRun){
				console.log(AutoTest.prototype.getLogColor.call(iteration.id), "Run '"+changedRun.name+"'=>"+changedRun.status);
				return Promise.resolve(changedRun.status);
			}.bind(run));		
	}.bind(this, run));
	
	return p;
};

AutoTest.prototype.validateSteps = function(steps, iteration, validator){
	var continueExecution = true;
	var pArr = [];
	var p = Promise.resolve();
	
	steps.forEach(function(step, idx){
		if ( typeof step !== 'object')
			return;
		if ( step.status != "Passed" || !iteration.ignoreStepPassed){

			console.log(this.getLogColor(iteration.id), "Step "+step.stepOrder+" running...");
			step.previousStatus = step.status;
			p = p.then( function(step){
				return validator.validateStep(step,idx);
			}.bind(this, step))
			//Attrib step status and attachments
			.then( function(status){
				continueExecution =  status && continueExecution;
				if ( this.status != "Not Completed" && this.previousStatus != "Not Completed" )
					this.status = status? "Passed" : "Failed";
				this.attachments.forEach(function(attachment,idx){
					p = p.then( function(){ //Insert attachments of Step in QC
						return qcApi.attach( this, {data: attachment.data, 
										 filename: attachment.filename, 
										 description: attachment.description} )
						.then(function(attached){
							if (attached){
								this.attachment = "Y";
							}
						}.bind(this));
					}.bind(this));
				}.bind(this));
			}.bind(step))
			//Update step in QC
			.then( function(){
					return qcApi.put( '/runs/'+this.run.id+'/run-steps/'+this.id,
									 {data: {"Type": "run-step",
											"id": this.id,
											"status": this.status,
											"actual": this.actual}} )
					.then(function(changedStep){
						if (changedStep){
							console.info("Step " + changedStep.stepOrder + "=>" + changedStep.status );
						}
					}.bind(this));
			}.bind(step));
		}else{
			console.log(this.getLogColor(iteration.id), "Step "+step.stepOrder+" not run ["+step.status+"]");
		}
	}.bind(this));
	//Após salvar todos os steps, retorna o status final da Run
	return p.then(function(){
		return Promise.resolve(continueExecution);
	});
};

AutoTest.prototype.iterationsBySheet = function(sheetUrl){
	var xlsFile = xls.readFile(sheetUrl);
	var dataMassSheet = xlsFile.Sheets[xlsFile.SheetNames[0]];
	var iterations = xls.utils.sheet_to_json(dataMassSheet);
	var iterationFields = ["validator","testInstanceId","testSetId","testConfigId","testId","params","package","query"];
	for ( var idx = 0; idx < iterations.length; idx++ ){
		var iteration = iterations[idx];
		if ( iteration.testInstanceId > 999999 ){
			iterations.splice(idx,1);
			--idx;
			continue;
		}
		iteration.id = idx;
		iteration["params"] = {};
		Object.getOwnPropertyNames(iteration).forEach(function(field,idx){
			if ( iterationFields.indexOf(field)<0 ){
				iteration.params[field] = iteration[field];
				delete iteration[field];
			}
		}, this);
	};
	return iterations;
};

AutoTest.prototype.getLogColor = function(iterationIdx){
	const FIRSTCOLOR_IDX = 31;
	if (!iterationIdx) return "\x1b[0m";
	
	while ( iterationIdx >= 10 ){
		iterationIdx = Number((iterationIdx/10).toFixed(0));
	}
	iterationIdx += FIRSTCOLOR_IDX;
	return "\x1b["+iterationIdx+"m";
};

AutoTest.prototype.run = function(options){
	this.setOptions(options);
	var treatError = function(err) { 
		console.log("\x1b[0m","[ERROR] " + JSON.stringify(err)); 
	};
	var p = qcApi.login(this.options).then(function(auth){
		console.log("successfully logged in!");
		this.errors = [];
		var cascadeArr = [];

		this.options.runs.forEach( function(iteration,idx){
			var pArr = [];
			console.log(this.getLogColor(idx),"***********Iteration ["+idx+"]***********");
			var queryArr =[];
		
			if ( iteration.testId ){ //Inicia consulta assincrona do Teste no 'Test Plan'
				queryArr.push( "test.id["+iteration.testId+"]" );
				pArr.push(qcApi.get('/tests/'+iteration.testId).then(function(test){
					iteration["test"] = test;
				}.bind(this),treatError) );
				console.log(this.getLogColor(idx),"buscando Teste "+iteration.testId+"...");
			}

			if ( iteration.testConfigId ){ //Inicia consulta assincrona da Configuração (Cenario) do Test no 'Test Plan'
				queryArr.push( "test-config.id["+iteration.testConfigId+"]" );
				pArr.push(qcApi.get('/test-configs/'+iteration.testConfigId, {query: queryArr}).then(function(testConfig){
					iteration["testConfig"] = testConfig;
				}.bind(this),treatError) );
				console.log(this.getLogColor(idx),"buscando TesteConfig "+iteration.testConfigId+"...");
			}
			
			if ( iteration.testSetId ){ //Inicia consulta assincrona do TestSet (Ciclo) no 'Test Lab'
				queryArr.push( "test-set.id["+iteration.testSetId+"]" );
				pArr.push(qcApi.get('/test-sets/'+iteration.testSetId, {query: queryArr}).then(function(testSet){
					iteration["testSet"] = testSet; 
				}.bind(this),treatError) );
				console.log(this.getLogColor(idx),"buscando TesteSet "+iteration.testSetId+"...");
			}
			queryArr = iteration.query? iteration.query.concat( queryArr ): queryArr.concat( this.options.defaultQuery );
			pArr.push(qcApi.get('/test-instances' + (iteration.testInstanceId?"/"+iteration.testInstanceId:""), {"query": queryArr})
			.then(function(testInstances){
				var pTiArr = [];
				iteration["testInstances"] = ( testInstances instanceof Array ? testInstances: [testInstances] );				
				iteration.testInstances.forEach(function(t,i){
					queryArr = ["test-instance.id["+t.id +"]"];
					var runFunc = function(runs){
						this["run"] = ( runs instanceof Array? runs[runs.length -1]: runs );
						this.run["steps"] = [];
						this.run["params"] = iteration.params;
						var pRunArr = [];
						queryArr = [];
						if ( iteration.stepOrder )
							queryArr.push( "step-order["+iteration.stepOrder.join(" OR ")+"]" );
						
						console.log(AutoTest.prototype.getLogColor.call(iteration.id),"buscando Steps ..."+(iteration.stepOrder?iteration.stepOrder.join():""));
						return qcApi.get('/runs/'+this.run.id+'/run-steps?order-by={step-order}', {"query": queryArr}).then(function(steps){
							steps.pop(); //Lista sempre vem com um step a mais por esta sendo removido 
							this.run.steps = steps;
						}.bind(t),treatError);
					}.bind(t);					
					
					if ( this.options.alwaysCreateRun || t.status == "Passed" || !t.execDate){
						var dateFormat = require('dateformat');
						var now = new Date();
						var id = dateFormat(now, "dd-mm_ss-MM-hh");					
						pTiArr.push(qcApi.post('/runs',{data: {  "type": "run",
															   "testcycl-id": t.id,
															   "cycle-id": t.cycleId,
															   "test-id": t.testId,
															   "subtype-id": "hp.qc.run.MANUAL",
															   "name": "Run_"+id,
															   "owner": this.options.user,
															   "status": "No Run",
																"comments": "Automated process"}} ).then(runFunc,treatError) );
					}else
						pTiArr.push(qcApi.get('/runs?order-by={execution-date;execution-time}', {"query": queryArr}).then(runFunc,treatError) );
					console.log(this.getLogColor(idx),"buscando Run para a iteração["+idx+"] ...");
				}.bind(this));
				return Promise.all(pTiArr);
			}.bind(this),treatError));			
			console.log(this.getLogColor(idx),"buscando Teste Instance(s) ..."+JSON.stringify(queryArr));

			//Sincroniza todos os processos
			cascadeArr.push(
				Promise.all(pArr).then(function(resolved){
					var pReadyTestArr = [];
					console.log("Consultas realizadas com base no filtro: " + resolved.length);
					console.log("Instâncias de teste encontradas:"+(iteration.testInstances? iteration.testInstances.length:0));
					iteration.testInstances.forEach(function(instance, i){
						pArr = [];
						if ( instance.run && instance.run.steps.length>0 ){
							if ( !iteration.testConfig ){
								pArr.push(qcApi.get('/test-configs/'+instance.testConfigId, 
										   {query: "test.id["+instance.testId+"]"}).then(function(testConfig){
									iteration["testConfig"] = testConfig;
									instance["testConfig"] = testConfig;
								},function(err) { 
									console.error("[ERROR] " + JSON.stringify(err)); 
								}) );
								console.log("buscando TestConfig "+instance.testConfigId+"...");
							}
							if ( !iteration.test ){
								pArr.push(
									qcApi.get('/tests/'+instance.testId).then(function(test){
									iteration["test"] = test;
									instance["test"] = test;
								},function(err) { 
									console.error("[ERROR] " + JSON.stringify(err)); 
								}) );
								console.log("buscando Test "+instance.testId+"...");
							}
							pReadyTestArr.push(
								Promise.all(pArr).then(function(resolved){
									var validator;
									if ( iteration.validator ){
										try{
											var pack = require(iteration.package);
										}catch(e){
											return Promise.reject("Package/module not found to execute tests in " + iteration.testConfig.name);
										}
										try{
											iteration.validator.split(".").forEach( function(name){
												pack = pack[name];
											});
											validator = pack();
										}catch(e){
											return Promise.reject("Can't load validator '"+iteration.validator+"' to execute tests in " + iteration.testConfig.name);
										}
									}else
										return Promise.reject("Can't define validator to execute tests in " + iteration.testConfig.name);
									console.log("\x1b[0m","Iniciando execução...");
									return this.validateTest(instance, iteration, validator);
									//.then(function(resultado){console.log("Status: "+resultado);});
								}.bind(this),treatError));
						}
					}.bind(this));
					return Promise.all(pReadyTestArr);		
				}.bind(this),treatError));
		}.bind(this));
		return Promise.all(cascadeArr);		
	}.bind(this), treatError);
	return p;
};

module.exports = new AutoTest();
// TestCase Dummy example
// To run in console use this command:
// node -e "tester = require('./TestCase.js'); tester.unitTest();"
//
var fs = require('fs');
require('promise');

function Validator(){};

Validator.prototype.requiredParams = function(){
	return {"someword":undefined, file: undefined};
}

Validator.prototype.validateStep = function (step){
	var index = parseInt(step.stepOrder);
    var params = step.run.params;
	var fName = params.file;

	switch ( index ) {
		case 1 : // Check if the file exists
			if(!fs.existsSync(fName)) {
				step.actual = "The file "+fName+" does not exists";
				return false;
			}
			var output = fs.readFileSync(fName);  //Consider size of the file when using the sync function
			step.attachments.push( {filename: "myfile.txt", data: output } );
			step.actual = "The file was found";
			params.fileContent = output;
			return true;
		case 2 : //Check if content has the expected word
			if ( params.fileContent ){
				var r = new RegExp(params.someword);
				if ( r.test(params.fileContent) ){
					step.actual = "Word found successfully";
					return true;
				}
			}			
			break;
      default :
        step.status = "Not Completed";
		step.actual = "Run manually";
        break;
    }
    return false;
};


Validator.prototype.unitTest = function(model){
	var stepModel = (arguments && arguments[0]) || {run: {"params":{someword:"www.apache.org", file: "./LICENSE"}},attachments: []};
	var p = Promise.resolve();
	for (i = 1; i <= 2; i++) {
		var step = {};
		Object.assign(step, stepModel);
		step.stepOrder = i;
		p = p.then(function(step){
			return this.validateStep(step);
		}.bind(this,step))
		.then( function(status) {
			console.log( "Step "+this.stepOrder+"=>"+status + " actual: " + this.actual );
			return status;
		}.bind(step))
		.catch( function(err){ throw err; });
	}
	p.then( function() {
		console.log( "Finished Unit Test" );
	});
}

module.exports = new Validator();
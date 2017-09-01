# QCTester

## Requirements

* Node JS v8
* Install the module
```
npm install git+https://github.com/bergerrc/QCTester.git
```
* Create your caller function like
```
var tester = require("QCTester");  
function(sheetFilename){
	tester.run(sheetFilename)
	.then(function(resolved){  //When all iterations finished
		console.log("Finished.");
	},function(err) {          //When something goes wrong in the implemention or connection
		console.log("[ERROR] " + JSON.stringify(err));
	});
}
```
## How to
* You must to develop a *Validator* class corresponding to your test case, this validatior must contain a method called validateStep(step). Inside of it, you should implement the conditions to return true (Passed) or return false (Failed) of each step number.
* Each *Validator* could be used by many variations of one or more Test cases.
* After the implementation you will map the *Validator* to the Test Cases in 'Test Lab' view of QC, using a flexible way to 'search' your test cases by testset or testconfig, or else. You can also pass the parameters your *Validator* need. This mapped information described should be named as 'iterations' detail.
* The test iterations (or scenarios) can be loaded programatically or by a sheet (which is more common) see sample in *./public/samples/IterationsExample.xlsx*.
* Setup your connection creating the file ./userconfig.json in your main path (see in ./test/userconfig.example.json)
* Run your caller function pointing to the iterations sheet created

## References
* [Node JS](https://nodejs.org/en/) - Engine Javascript

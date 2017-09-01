var chai = require('chai');
var alm = require('alm-global');
var assert = chai.assert;

describe("when calling single test", function(){
    var options = {
        runs: [{"package":"alm-tests-exec",
                "validator":"bd02_st01",
                "testSetId":"15938",
                "testConfigId":"87142",
                "params":{"UF":"MG", 
                            "MKT": 127,
                            "file":"../../2017/Regulatorios/Release 17.08 - PISCOFINS-ICMS/Tests/QA/Dia5b/M127.VE06.txt",
                            "period.start":"28/07/2017",
                            "period.finish":"02/08/2017",
                            "invoice.number": 47074}
                }]};

    it("should start and resolve test", function(done){

        alm.run(options)
        .then(function(resolved){
            assert.isNotNull(err, null);
            done();
        },function(err) {
            logger.log("Failed to run"+err);
            return;
        });
    });
});

describe("multiple tests", function(){
    var options = {
        runs: [{"package":"alm-tests-exec",
                "validator":"bd02_st01",
                "testSetId":"15938",
                "testConfigId":"87137",
                "params":{"UF":"SP",
                            "MKT":"125",
                            "file":"../../2017/Regulatorios/Release 17.08 - PISCOFINS-ICMS/Tests/QA/Dia5b/M125.VE06.txt",
                            "period.start":"28/07/2017",
                            "period.finish":"02/08/2017",
                            "invoice.number":"45083"}
                },
                {"package":"alm-tests-exec",
                "validator":"bd02_st01",
                "testSetId":"15938",
                "testConfigId":"87138",
                "params":{"UF":"MA",
                            "MKT":"125",
                            "file":"../../2017/Regulatorios/Release 17.08 - PISCOFINS-ICMS/Tests/QA/Dia5b/M125.VE06.txt",
                            "period.start":"28/07/2017",
                            "period.finish":"02/08/2017",
                            "invoice.number":"45084"}
                }]};

        it("should start each test", function(done){
    
            alm.run(options)
            .then(function(resolved){
                assert.isNotNull(err, null);
                done();
            },function(err) {
                logger.log("Failed to run"+err);
                return;
            });
        });
});
/********************************************************************************
 * rdao_sqlite3.js
 * Sqlite3 rdao driver
 * 
 * Author : Stephane Potelle 
 * Email  : stephane.potelle@gmail.com
********************************************************************************/

var mssql = require('tedious');
var data = require('./datatable.js');
var rdao = require ('./rdao_common.js');
var promisify = require('util').promisify;

isFunction = rdao.isFunction;
then = rdao.then;

class Connection {
    constructor() {
        this.debugMode = true;
        this.lastInsertId = null;
        this.lastStatementChanges = null;
        this.timeoutMilliSeconds = 10000;

        this.openAsync = promisify(this.open)
        this.getDataTableAsync = promisify(this.getDataTable)
        this.getListAsync = promisify(this.getList)
        this.getKVListAsync = promisify(this.getKVList)
        this.getScalarAsync = promisify(this.getScalar)
        this.execAsync = promisify(this.exec)
        this.execMultipleAsync = promisify(this.execMultiple)   
        this.closeAsync = promisify(this.close)     
    }
    
    debug(f,s) {
       if (this.debugMode) console.log(f + ": " + s)
    }

    open(dbname, callback) {
        this.db =  new mssql.Connection(dbname);
        this.debug('open','Opening connection for MSSQL')
        this.db.on('connect', function(err) { callback(err) } )
    }

    batch() {
        return new rdao.Batch(this);
    }

    close(callback) {
        let self=this
        this.debug('close','Closing connection for MSSQL')
        this.db.on('end', function(err) { 
            if (!err) self.debug('close','connection closed')
            callback(err)} 
        )
        this.db.close()
    }

    sqlDate(d) { return rdao.sqlDate(this,d) }
    sqlParam(value) { return rdao.sqlParam(this, value) }
    mergeParams(sql, params) { return rdao.mergeParams(this, sql, params) }
    getRealSql(queryObject) { return rdao.getRealSql(this, queryObject) }

    getDataTable(params, callback) {
        var ts = Date.now();
        var realSql = this.getRealSql(params); 
        var self = this;
        this.debug("getDataTable",realSql);
        let dt = new data.DataTable;
        let headersRead = false
        let request = new mssql.Request(realSql, function(err, rows, fields)  {
            if (err) {
                self.debug("getDataTable",'Error: '+err.code);
                then( function() {callback(err)}) ;
            } else {
                
                if (rows.length > 0 ) {
                    let cols = Object.keys(rows[0])
                    for (let c = 0; c< cols.length; c++) dt.addColumn(cols[c])
                    for (let r = 0; r<rows.length; r++ ) {
                        dt.addRow( dt.newRow(rows[r]));
                    }
                }
                self.debug("getDataTable",'Completed in ' + (Date.now() -ts) + ' ms');
                if (isFunction(callback)) then( function() { callback(undefined, dt) } );
            }
        })
        request.on('row', function(columns) { 
            if (! headersRead ) {
                for ( let i=0; i< columns.length; i++) {
                    dt.addColumn(columns[i].metadata.colName)
                }
                headersRead = true
            }
            let dr = dt.newRow()
            for ( let i=0; i< columns.length; i++) {
                dr.items[i]=columns[i].value
            }
            dt.addRow(dr)
        }) 
        this.db.execSql(request)
    }

    getList(params, callback) {
        var ts = Date.now();
        var realSql = this.getRealSql(params); 
        var self = this;
        this.debug("getList",realSql);
        let list = [];
        let request = new mssql.Request(realSql, function(err,rowcount)  {
            if (err) {
                self.debug("getList",'Error: '+err.code);
                then( function() { callback(err)}) ;
            } else {
                self.debug("getList",'Completed in ' + (Date.now() -ts) + ' ms');
                if (isFunction(callback)) then( function() { callback(undefined, list) } );
            }
        });
        request.on('row', function(columns) { 
            list.push(columns[0].value); 
        }) 
        this.db.execSql(request)
    }    

    readTableStructure(tn, callback) {
        var ts = Date.now();
        var self = this;
        let realSql = `select col.name from sys.tables tab inner join sys.columns as col on tab.object_id = col.object_id where tab.name ='${tn}'`
        this.debug("readStructure",realSql);
        let list = [];
        let request = new mssql.Request(realSql, function(err,rowcount)  {
            if (err) {
                self.debug("readStructure",'Error: '+err.code);
                then( function() { callback(err)}) ;
            } else {
                self.debug("readStructure",'Completed in ' + (Date.now() -ts) + ' ms');
                if (isFunction(callback)) then( function() { callback(undefined, list) } );
            }
        });
        request.on('row', function(columns) { 
            list.push(columns[0].value); 
        }) 
        this.db.execSql(request)
    }    

    getKVList(params, callback) {
        var ts = Date.now();
        var realSql = this.getRealSql(params); 
        var self = this;
        this.debug("getKVList",realSql);
        let list = [];
        let request = new mssql.Request(realSql, function(err,rowcount)  {
            if (err) {
                self.debug("getKVList",'Error: '+err.code);
                then( function() { callback(err)}) ;
            } else {
                self.debug("getKVList",'Completed in ' + (Date.now() -ts) + ' ms');
                if (isFunction(callback)) then( function() { callback(undefined, list) } );
            }
        });
        request.on('row', function(columns) { 
            if (columns.length >1 ) { list.push( [columns[0].value , columns[1].value ] )}
            else { list.push( [columns[0].value , columns[0].value ] ) }
            
        }) 
        this.db.execSql(request)
    }       

    getScalar(params, callback) {
        var ts = Date.now();
        var realSql = this.getRealSql(params); 
        var self = this;
        this.debug("getScalar",realSql);
        let dt = new data.DataTable;
        let valueRead = false
        let retVal
        let request = new mssql.Request(realSql, function(err, rows, fields)  {
            if (err) {
                self.debug("getScalar",'Error: '+err.code);
                then( function() {callback(err)}) ;
            } else {
                self.debug("getScalar",'Completed in ' + (Date.now() -ts) + ' ms');
                if (isFunction(callback)) then( function() { callback(undefined, retVal) } );
            }
        })
        request.on('row', function(columns) { 
            if (! valueRead ) {
                retVal = columns[0].value
                valueRead = true
            }
        }) 
        this.db.execSql(request)        
    }

    exec(params, callback) { rdao.exec(this, params, callback) }
    execMultiple(queries, callback) { rdao.execMultiple(this, queries, callback) }

    execSingle(params, callback) {
        var self=this;
        var ts = Date.now();
        var realSql = this.getRealSql(params); 
        this.debug("execSingle",realSql);
        realSql = realSql + "; select @@ROWCOUNT, @@IDENTITY"
        let request = new mssql.Request(realSql, function(err, rowcount, rows)  {
            if (err) { 
                self.debug("execSingle",'Error: '+err.code);
                then( function() {callback(err)}) ;
            }
            else { 
                //self.lastInsertId = 0 //if (result.insertId > 0) self.lastInsertId = result.insertId;
                //self.lastStatementChanges = 0 //result.affectedRows;
                self.debug("execSingle",'Completed in ' + (Date.now() -ts) + ' ms LastId: ' + self.lastInsertId + ' Changes: ' + self.lastStatementChanges);
                then(callback)
            };
        })
        request.on('row', function(columns) { 
            self.lastStatementChanges = columns[0].value
            self.lastInsertId = columns[1].value
        })         
        this.db.execSql(request)
    }

}

exports.Connection = Connection;
 
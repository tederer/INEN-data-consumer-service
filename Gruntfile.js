/* global global */
'use strict';

var path       = require('path');
var fileSystem = require('fs');

global.PROJECT_ROOT_PATH        = path.resolve('.');
global.PROJECT_SOURCE_ROOT_PATH = global.PROJECT_ROOT_PATH + '/src/';

var JS_FOLDER_IN_WEBROOT        = global.PROJECT_ROOT_PATH + '/webroot/javascripts/';
var CLIENT_LIBRARY              = JS_FOLDER_IN_WEBROOT + 'temperatureUi.js';

module.exports = function(grunt) {

   var jsFiles = ['Gruntfile.js', 'src/**/*.js', 'test/**/*.js'];
   
   grunt.initConfig({
      jshint: {
         allButNotSettings : {
            options: {
               jshintrc: '.jshintrc'
            },
            src: jsFiles
         }
      },

      mochaTest: {
			libRaw: {
			  options: {
				 require: ['test/testGlobals.js'],
				 reporter: 'spec'
			  },
			  src: ['test/**/*.js']
			}
      },           

      clean: [JS_FOLDER_IN_WEBROOT],
      
      concat: {
         javascripts: {
            src: ['src/common/infrastructure/**/*.js', 'src/client/**/*.js', 'src/SharedTopics.js'],
            dest: CLIENT_LIBRARY,
            filter: function(filepath) {
               var nameSpaceUtils = 'NamespaceUtils.js';
               return filepath.length < nameSpaceUtils.length ||
                        filepath.indexOf(nameSpaceUtils) !== (filepath.length - nameSpaceUtils.length);
            }
         }
      }
   }); 

   var sortPrototypeAssignments = function sortPrototypeAssignments(assignmentsAsString) {
      var regexp = /\s*([^\s]+).prototype\s*=\s*new\s*([^\s\(]+).*/;
      
      var toObject = function toObject(assignmentAsString) {
         regexp.exec(assignmentAsString);
         return {parent: RegExp.$2, child: RegExp.$1};
      };
      
      var sortFunction = function sortFunction(first, second) {
         var result;
         if (first.parent === second.parent) {
            result = 0;
         } else {
            result = (first.parent === second.child) ? 1 : -1;
         }
         return result;
      };
      
      var toString = function toString(assignmentObject) {
         return assignmentObject.child + '.prototype = new ' + assignmentObject.parent + '();';
      };
      
      return assignmentsAsString.map(toObject).sort(sortFunction).map(toString);
   };
   
	var nonThisPrototypes = function nonThisPrototypes(prototypeDeclaration) {
		return prototypeDeclaration.indexOf('this.prototype') === -1;
	};

   grunt.task.registerTask('correctConcatenatedFile', 'moves the prototype assignments to the end of the file and brings them into the right order', function() {
      var CRLF = '\r\n';
      var prototypeRegexp = /.*(?<!this)\.prototype =.*/g;
      var requireRegexp = /require\([^\(]*\);\s*\r?\n/g;
      var linterSettingsRegexp = /\/\*\s*global[^\n]*\r?\n/g;
      var concatenatedContent = fileSystem.readFileSync(CLIENT_LIBRARY, 'utf8');
      var namespaceUtilsContent = fileSystem.readFileSync(global.PROJECT_SOURCE_ROOT_PATH + 'common/NamespaceUtils.js', 'utf8');
		var sortedNonThisPrototypeAssignments = [];
		var allPrototypeDeclarations = concatenatedContent.match(prototypeRegexp);
		
		if (allPrototypeDeclarations !== null) {
			var nonThisPrototypeAssignments = allPrototypeDeclarations.filter(nonThisPrototypes);
			sortedNonThisPrototypeAssignments = sortPrototypeAssignments(nonThisPrototypeAssignments);
			if (sortedNonThisPrototypeAssignments === null) {
				console.log('no prototype assignments found');
			}
      }
      
		var newContent = (namespaceUtilsContent + concatenatedContent)
									//.replace(prototypeRegexp, '')
									.replace(requireRegexp, '')
									.replace(linterSettingsRegexp, '');
		fileSystem.writeFileSync(CLIENT_LIBRARY, newContent, 'utf8');
		//fileSystem.appendFileSync(CLIENT_LIBRARY, CRLF + sortedNonThisPrototypeAssignments.join(CRLF), 'utf8');
		//console.log(CRLF + '\tmoved ' + sortedNonThisPrototypeAssignments.length + ' prototype assignements to the end of ' + CLIENT_LIBRARY);
   });

   grunt.loadNpmTasks('grunt-contrib-jshint');
   grunt.loadNpmTasks('grunt-mocha-test');
   grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-concat');
   
   grunt.registerTask('lint', ['jshint']);
   grunt.registerTask('test', ['mochaTest:libRaw']);
   
   grunt.registerTask('default', ['clean', 'lint', 'test', 'concat', 'correctConcatenatedFile']);
 };

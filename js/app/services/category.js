;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('categoryService', ['appConfig', '$firebaseObject', function(appConfig, $firebaseObject) {
        var ref = new Firebase(appConfig.firebaseUrl);
        var createCategoryRef = function() {
            var categoryRef = ref.child('categories');
            categoryRef.on('value', function(snapshot) {
                if (snapshot.val() === null) {
                    categoryRef.set({});
                }
            });
        };
        
        var createCategory = function(id, name) {
            var categoryRef = ref.child('categories');
            var childRef = categoryRef.child(id);
            childRef.set({name: name, meetings: []});
        }
        
        return {
            addToCategory: function (category, id) {
                createCategory('bbb', 'BBB');
                return 'xxx';
            }
        }
    }]);
})();

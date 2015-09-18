;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('categoryService', ['appConfig', '$firebaseObject', function(appConfig, $firebaseObject) {
        var ref = new Firebase(appConfig.firebaseUrl + '/categories');
        
        var addMeetingToCategory = function (categoryId, categoryName, meeting) {
            var categoryRef = ref.child(categoryId);
            categoryRef.child('name').once('value', function(snapshot) {
                // if category does not exist
                if (snapshot.val() === null) {
                    categoryRef.set({id: categoryId, name: categoryName, meetings: [meeting]});
                } else {
                    categoryRef.child('meetings').push(meeting);
                }
            }); 
        };
        
        var getCategories = function() {
            return $firebaseObject(ref);
        };
        
        return {
            addMeetingToCategory: addMeetingToCategory,
            getCategories: getCategories
        }
    }]);
})();

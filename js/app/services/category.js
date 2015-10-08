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
        
        var removePassedActivity = function (categoriesObject) {
            _.forEach(categoriesObject, function (category, categoryName) {
                if (category && category.meetings) {
                    _.forEach(category.meetings, function(meeting, meetingId) {
                        if (moment().diff(moment(meeting.createdDate)) > 2 * 86400 * 1000) {
                            delete category.meetings[meetingId];
                        }
                    });
                    if (Object.keys(category.meetings).length === 0) {
                        delete category.meetings;
                    }
                }
            });
            categoriesObject.$save();

        }
        
        return {
            addMeetingToCategory: addMeetingToCategory,
            getCategories: getCategories,
            removePassedActivity: removePassedActivity
        }
    }]);
})();

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
                    categoryRef.child('meetings').child(meeting.id).set(meeting);
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
                        var expireTime = meeting.expireTime || meeting.timeTitle;
                        if (moment().diff(moment(expireTime)) > 3600 * 1000) {
                            delete category.meetings[meetingId];
                        }
                    });
                    if (Object.keys(category.meetings).length === 0) {
                        delete category.meetings;
                    }
                }
            });
            categoriesObject.$save();

        };
        
        var updateExpireTime = function (categoryId, meetId, expireTime) {
            var categoryRef = ref.child(categoryId).child('meetings').child(meetId);
            categoryRef.once('value', function(snapshot) {
                // if category does not exist
                if (snapshot.val() !== null) {
                    categoryRef.update({expireTime: expireTime});
                } 
            }); 
        };
        
        return {
            addMeetingToCategory: addMeetingToCategory,
            getCategories: getCategories,
            removePassedActivity: removePassedActivity,
            updateExpireTime: updateExpireTime
        }
    }]);
})();

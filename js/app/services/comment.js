;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('commentService', 
    ['$rootScope', 'appConfig', '$firebaseObject', '$q',
    function($rootScope, appConfig, $firebaseObject, $q) {
        var ref = new Firebase(appConfig.firebaseUrl);
        
        var addComment = function (meetingId, groupId, data) {
            ref.child('comments').child(meetingId).child(groupId).push(data);
        };
          
        var getComments = function (meetingId) {
            var deferred = $q.defer();
            
            ref.child('comments').child(meetingId).once("value", function(snapshot) {
                var data = snapshot.val();
                if (data) {
                    deferred.resolve(data);
                } else {
                    deferred.resolve([]);
                }
            });
            return deferred.promise;
        };
        
        var broadcastChange = function (meetingId) {
            var comments = getComments(meetingId);
            comments.then(function(data) {
                $rootScope.$broadcast('comment.changed', data);
            });
        };
        
        var trackComment = function (meetingId) {
            var notificationRef = ref.child('comments').child(meetingId);
            
            // new notification
            notificationRef.limitToLast(1).on('child_added', function() {
                broadcastChange(meetingId);
            });
                      
            // reset notification
            notificationRef.on('child_changed', function() {
                broadcastChange(meetingId);
            });
            
        };
        
        
        return {
            addComment: addComment,
            getComments: getComments,
            trackComment: trackComment
        }
    }]);
})();

;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('historyService', 
    ['$rootScope', 'appConfig', '$firebaseObject', '$q',
    function($rootScope, appConfig, $firebaseObject, $q) {
        var ref = new Firebase(appConfig.firebaseUrl);
        
        var addHistoryToUser = function (userId, meetId, historyData) {
            ref.child('history').child(userId).child(meetId).set(historyData);
        };
        
           
        var getLastHistory = function (userId, limit) {
            var deferred = $q.defer();
            
            ref.child('history').child(userId).endAt().limitToLast(limit).once("value", function(snapshot) {
                var data = snapshot.val();
                if (data) {
                    var arrayData = Object.keys(data).map(function (key) {
                        data[key].id = key;
                        return data[key];
                    });
                    deferred.resolve(arrayData);
                } else {
                    deferred.resolve([]);
                }
            });
            return deferred.promise;
        };
        
        
        var removeHistory = function (userId, historyId) {
            var historyRef = ref.child('history').child(userId);
            historyRef.child(historyId).remove();
        };
        
        var removeAllHistory = function (userId) {
            var historyRef = ref.child('history').child(userId);
            historyRef.remove();
        };
        
        return {
            addHistoryToUser: addHistoryToUser,
            getLastHistory: getLastHistory,
            removeHistory: removeHistory,
            removeAllHistory: removeAllHistory
        };
    }]);
})();

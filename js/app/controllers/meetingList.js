;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    var firebaseUrl = 'https://radiant-heat-9175.firebaseio.com';
    $.urlParam = function(name) {
        var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results==null){
            return null;
        }
        else{
            return results[1] || 0;
        }
    };
    var refs = {};
    
    // get data from yelp
    app.controller('MeetingListCtrl', ['$scope', 'dataProvider', function ($scope, dataProvider) {
        var meetId = null;
        
        if ($.urlParam('meet')) {
            meetId = $.urlParam('meet');
        }
        
        refs.invitedMeet = new Firebase(firebaseUrl+ '/meets/' + meetId);
        refs.meets = new Firebase(firebaseUrl + '/meets');
        
        refs.invitedMeet.once('value', function(snapshot){
            $scope.invitedMeet = snapshot.val();
            console.log(snapshot.val());
        });
        
    }]);
})();

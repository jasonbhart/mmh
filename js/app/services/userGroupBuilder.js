;(function() {
    "use strict";

    function UserGroupBuilder() {

        function buildMap(users, field, groupField) {
            var valuesMap = {};
            // if user selected group and such "where/when" exists among items selected by him
            // user will stick to that "where/when"
            // in other case he will be processed normally
            for (var i=0; i<users.length; i++) {
                var values = users[i].group ? [users[i].group[groupField]] : users[i][field];
                
                for (var j=0; j<values.length; j++) {
                    var item = values[j];
                    if (valuesMap[item] === undefined) {
                        valuesMap[item] = {
                            id: item,
                            users: [],
                            count: 0
                        };
                    }

                    valuesMap[item].count++;
                    valuesMap[item].users.push(users[i]);
                }
            }

            // convert map to list
            var result = _.values(valuesMap);
            result.sort(function(a, b) {
                return b.count - a.count;     // desc sort
            });

            return result;
        }

        /**
         * Validates and cleanups user selected groups
         * @param {Array} users
         */
        this.cleanup = function(users) {
            // validate selected groups
            _.forEach(users, function(user) {
                if (!user.group)
                    return;
                
                var whereId = user.group.where;
                var whenId = user.group.when;

                // user selected group is invalid
                if (user.whereIds.indexOf(whereId) == -1
                    || user.whenIds.indexOf(whenId) == -1) {
                    user.group = null;
                }
            });
        }
        
        this.build = function (allPlaces, allTimes, users, currentUser) {
            var allGroups = {};
            _.forEach(allPlaces, function(place) {
                _.forEach(allTimes, function(time){
                    var groupId = place + '-' + time;
                    var group = {
                        userIds: [],
                        when: {id: time},
                        where: {id: place},
                        count: 0
                    }
                    allGroups[groupId] = group;
                });
            });
            
            _.forEach(users, function(user) {
                _.forEach(user.whenIds, function (whenId){
                    _.forEach(user.whereIds, function(whereId) {
                        var groupId = whereId + '-' + whenId;
                        allGroups[groupId].userIds.push(user.userId);
                        allGroups[groupId].count ++;
                    });
                });
            });
            return _.filter(allGroups, function (group) {
                return group.count >= 2;
            });
        }

        
    }
    
    var app = angular.module('mmh.services');
    
    app.service('userGroupBuilder', UserGroupBuilder);
})();

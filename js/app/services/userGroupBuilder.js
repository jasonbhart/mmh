;(function() {
    "use strict";

    function UserGroupBuilder() {

        function buildMap(users, field) {
            var valuesMap = {};

            for (var i=0; i<users.length; i++) {
                var values = users[i][field];
                for (var j=0; j<values.length; j++) {
                    var item = values[j];
                    if (valuesMap[item] === undefined) {
                        valuesMap[item] = 0;
                    }

                    valuesMap[item]++;
                }
            }

            // convert map to list
            var result = [];
            _.forOwn(valuesMap, function(value, key) {
                result.push({
                    id: key,
                    count: value
                });
            });

            result.sort(function(a, b) {
                return b.count - a.count;     // desc sort
            });

            return result;
        }

        // build group with the biggest number of members
        function buildGroup(users) {
            var whereMap = buildMap(users, 'whereIds');
            var where = {
                id: undefined,
                count: 0
            };
            var when = {
                id: undefined,
                count: 0
            };

            // loop through whereMap in desc order
            for (var i=0; i<whereMap.length; i++) {

                // get users for the current where value
                var whenUsers = _.filter(users, function(u) {
                    return u.whereIds.indexOf(whereMap[i].id) >= 0;
                });

                var whenMap = buildMap(whenUsers, 'whenIds');

                // the biggest count is at 0 index
                if (whenMap.length > 0 && whenMap[0].count > when.count) {
                    where.id = whereMap[i].id;
                    where.count = whereMap[i].count;
                    when.id = whenMap[0].id;
                    when.count = whenMap[0].count;
                }
            }

            var group = null;

            // here we have ids
            if (where.id && when.id) {
                var group = {
                    userIds: [],
                    location: users[0].location,
                    where: where,
                    when: when
                }

                group.userIds = _.map(
                    _.filter(users, function(u) {
                        return u.whereIds.indexOf(where.id) >= 0
                            && u.whenIds.indexOf(when.id) >= 0;
                    }), function(u) {
                        return u.userId;
                    }
                );
            }

            return  group;
        }
        
        this.fuzzyMatchWhen = function(groups, user, whenMap) {
            var secondsLimit = 15 * 60;     // 15 minutes

            // convert user's when to durations
            var userWhen = _.map(user.whenIds, function(id) {
                return moment.duration(whenMap[id]);
            });

            // try match group's when with user's when
            for (var i=0; i<groups.length; i++) {
                var group = groups[i];
                var groupWhen = moment.duration(whenMap[group.when.id]);
                
                for (var j=0; j<userWhen.length; j++) {
                    var when = userWhen[j];
                    var seconds = moment.duration(when)
                                    .subtract(groupWhen)
                                    .asSeconds();
                    seconds = Math.abs(seconds);
                    
                    // we have a match if difference in seconds is less than limit
                    if (seconds <= secondsLimit) {
                        return group;
                    }
                }
            }

            return null;
        }

        // build all groups
        this.build = function (users, whenMap) {
            var groups = [];

            while (users.length > 0) {
                var group = buildGroup(users);

                // this can happen when "where/when" fields are empty
                if (!group)
                    break;

                // filter out users that belong to just created group
                var leftUsers = [];
                var usedUsers = [];
                _.forEach(users, function(u) {
                    var idx = group.userIds.indexOf(u.userId);
                    if (idx < 0)
                        leftUsers.push(u);
                    else
                        usedUsers.push(u);
                });
                users = leftUsers;

                // try fuzzy match
                if (group.userIds.length == 1) {
                    var user = usedUsers[0];
                    
                    // we need to match against only those groups having the same where as a user
                    var groupsToMatch = _.filter(groups, function(g) {
                        return user.whereIds.indexOf(g.where.id) >= 0;
                    });
                    
                    var otherGroup = this.fuzzyMatchWhen(groupsToMatch, user, whenMap);

                    // add user to matching group
                    if (otherGroup) {
                        otherGroup.userIds.push(usedUsers[0].userId);
                        group = null;
                    }
                }

                if (group)
                    groups.push(group);
            }

            return groups;
        }
    }
    
    var app = angular.module('mmh.services');
    
    app.service('userGroupBuilder', UserGroupBuilder);
})();

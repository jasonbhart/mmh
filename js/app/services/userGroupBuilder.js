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

        // build group with the biggest number of members
        function buildGroup(users) {
            var where = {
                    id: undefined,
                    count: 0
                },
                when = {
                    id: undefined,
                    count: 0
                },
                groupUsers = null;
            
            var whereMap = buildMap(users, 'whereIds', 'where');

            // loop through whereMap in desc order
            for (var i=0; i<whereMap.length; i++) {

                var whenMap = buildMap(whereMap[i].users, 'whenIds', 'when');

                // the biggest count is at 0 index
                if (whenMap.length > 0 && whenMap[0].count > when.count) {
                    where.id = whereMap[i].id;
                    where.count = whereMap[i].count;
                    when.id = whenMap[0].id;
                    when.count = whenMap[0].count;
                    groupUsers = whenMap[0].users;
                }
            }

            var group = null;

            // here we have ids
            if (where.id && when.id) {
                group = {
                    userIds: _.pluck(groupUsers, 'userId'),
                    where: where,
                    when: when
                }
            }

            return  group;
        }
        
        this.fuzzyMatchWhen = function(groups, user, whenMap) {
            var secondsLimit = 15 * 60;     // 15 minutes

            // if user selected group need to use only it's value
            var whenIds = user.group ? [user.group.when] : user.whenIds;

            // convert user's when to durations
            var userWhen = _.map(whenIds, function(id) {
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

        // build all groups
        this.build = function (users, whenMap) {
            var groups = [];

            this.cleanup(users);

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
                        if (user.group)
                            return user.group.where == g.where.id;
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

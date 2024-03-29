var guid = '';
var meetId = '';

function getFormatedTime(date) {
	var isoHour = date.getHours();
	var localHour = isoHour > 12 ? isoHour - 12 : isoHour;
	var minute = date.getMinutes();
        if (minute < 10) minute = '0' + minute;
        
	return localHour + ":" + minute + (isoHour >= 12 ? 'PM' : 'AM');
}

self.addEventListener('push', function (event) {
    event.waitUntil(
        fetch('https://edgeprod.com:8081/getLastNotification?guid=' + guid).then(function (response) {
            return response.json().then(function(data) {  
   
                if (data.type === 'comment') {
                    var title = data.title;
                } else {
                    var date = new Date(data.time);
                    var title = data.title + ' (' + data.place + ' @ ' + getFormatedTime(date) + ')';
                }
                var body = data.body || 'There is newly updated content available on the site. Click to see more.';
                meetId = data.meetId || '';
                var icon = data.image || 'https://www.socialivo.com/design/image/favicon.png';
                var tag = 'socialivo';
                self.registration.showNotification(title, {  
                    body: body,  
                    icon: icon,  
                    tag: tag  
                });
            });  
            
        }).catch(function (err) {
            self.registration.showNotification('New notification', {
                body: 'There is newly updated content available on the site. Click to see more.',
                icon: 'https://www.socialivo.com/design/image/favicon.png',
                tag: 'socialivo'
            });
        })

    );
});

self.addEventListener('install', function(event) {
  if (self.skipWaiting) { self.skipWaiting(); }
});

self.addEventListener('message', function (evt) {
    console.log('postMessage received', evt.data);
    if (evt.data.action === 'send guid') {
        guid = evt.data.guid;
    }
    evt.ports[0].postMessage({'test': 'This is my response.'});
})

self.addEventListener('notificationclick', function (event) {
    console.log('On notification click: ', event.notification.tag);
    // Android doesn't close the notification when you click on it  
    // See: http://crbug.com/463146  
    event.notification.close();

    // This looks to see if the current is already open and  
    // focuses if it is  
    event.waitUntil(
            clients.matchAll({
                type: "window"
            })
            .then(function (clientList) {
                for (var i = 0; i < clientList.length; i++) {
                    var client = clientList[i];
                    if (client.url == '/' && 'focus' in client)
                        return client.focus();
                }
                if (clients.openWindow) {
                    if (meetId) {
                        return clients.openWindow('https://www.socialivo.com/activity.html?act=' + meetId);
                    } else {
                        return clients.openWindow('https://www.socialivo.com');
                    }
                    
                }
            })
            );
});
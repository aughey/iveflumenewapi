import { useEffect } from 'react';
import React from 'react';
import { Client, Message } from '@stomp/stompjs';
import { throttle } from 'lodash';

export default function ReceiveTest() {
    const [stomp,setStomp] = React.useState(null);

    useEffect(() => {
        const client = new Client({
            brokerURL: 'ws://localhost:15674/ws',

            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });

        client.onConnect = function (frame) {
            // Do something, all subscribes must be done is this callback
            // This is needed because this will be executed after a (re)connect
            console.log("Stomp connected");
            console.log(frame);
            setStomp(client);
        };

        client.onStompError = function (frame) {
            // Will be invoked in case of error encountered at Broker
            // Bad login/passcode typically will cause an error
            // Complaint brokers will set `message` header with a brief message. Body may contain details.
            // Compliant brokers will terminate the connection after any error
            console.log('Broker reported error: ' + frame.headers['message']);
            console.log('Additional details: ' + frame.body);
        };

        client.onDisconnect = function (frame) {
            setStomp(null);
        }

        client.activate();

        return () => {
            client.deactivate();
        }
    }, [])

    if(!stomp) {
        return (<div>Connecting...</div>)
    }

    return (<Listen stomp={stomp}/>)
}

function Listen({stomp}) {
    const ref = React.useRef(null);
    const [listen, setListen] = React.useState(false);
    
    useEffect(() => {
        if(!listen) {
            return;
        }
        const exchange = "/exchange/HelloWorld"
        const throttledset = message => {
            ref.current.innerHTML = message.body;
        };
        const sub = stomp.subscribe(exchange,  throttledset);
        return () => {
            sub.unsubscribe();
        }
    } , [stomp,listen])

    return (<div >Looking for message...
        <button onClick={() => setListen(!listen)}>{listen ? "Stop listening" : "Start listening"}</button>
        <div ref={ref}>

        </div>
    </div>)
}
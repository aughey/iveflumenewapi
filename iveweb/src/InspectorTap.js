import { v4 as uuid } from 'uuid';
import { Client } from '@stomp/stompjs';
import EventEmitter from 'events';

export default async function InspectorTap(downstream_setgraph) {
    let tapped = [];
    let last_graph = { Nodes: [], Connections: [] };

    const events = new EventEmitter();


    const setGraph = async (graph) => {
        console.log("Setting graph")
        await runTap(graph);
        last_graph = graph;
    }

    const stomp = new Client({
        brokerURL: 'ws://localhost:15674/ws',

        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
    });

    stomp.activate();

    await new Promise(resolve => {
        stomp.onConnect = function (frame) {
            console.log("Stomp connected");
            resolve();
        }
    });
    stomp.onDisconnect = function (frame) {
        console.log("Stomp disconnected");
    }

    // Create a queue for the inspector to use
    const myqueue = "inspectorqueue-" + uuid();

    const subscription = stomp.subscribe('/queue/' + myqueue, message => {
        //console.log("Got message in InspectorTap");
        //console.log(message.body);
        const data = JSON.parse(message.body);
        events.emit(data._ID, data);
    }, {
        durable: false,
        "auto-delete": true
    });

    const infrastructure = { Nodes: [], Connections: [] };
    const addInfrastructure = (kind, props) => {
        const node = {
            Kind: kind,
            Id: uuid()
        }
        if (props) {
            node.Properties = props;
        }
        infrastructure.Nodes.push(node);
        return node;
    }
    const connectInfrastructure = (from, output, to, input) => {
        infrastructure.Connections.push({
            From: from.Id,
            OutputPort: output,
            To: to.Id,
            InputPort: input
        });
    }

    const rabbitmq_host = addInfrastructure('Value-StringValue', { State: "localhost" });
    const rabbitmq_connect = addInfrastructure('RabbitMQOperations-ConnectToChannel');
    const rabbitmq_queuename = addInfrastructure('Value-StringValue', { State: myqueue });
    const throttle_time = addInfrastructure('Value-Int32Value', { State: parseInt(1000/10.0).toString() });
    const send_action = addInfrastructure('RabbitMQOperations-SendQueueAction');

    connectInfrastructure(rabbitmq_host, "output", rabbitmq_connect, "host");
    connectInfrastructure(rabbitmq_connect, "connection", send_action, "connection");
    connectInfrastructure(rabbitmq_queuename, "output", send_action, "queueName");

    // There is a race condition with setting graphs and inspecting in the middle.

    const runTap = async graph => {
        if(tapped.length === 0) {
            return await downstream_setgraph(graph);
        }

        const newnodes = [];
        const newconnections = [];

        // Append our infrastructure
        newnodes.push(...infrastructure.Nodes);
        newconnections.push(...infrastructure.Connections);


        for (const tap_id of tapped) {
            const node = graph.Nodes.find(n => n.Id === tap_id);
            if (!node) {
                console.log("Node not found in tap: ", tap_id);
                continue;
            }

            const addNode = (kind, props) => {
                const node = {
                    Kind: kind,
                    Id: uuid(),
                    Properties: props
                }
                newnodes.push(node);
                return node;
            }
            const addConnection = (from, output, to, input) => {
                newconnections.push({
                    From: from.Id,
                    OutputPort: output,
                    To: to.Id,
                    InputPort: input
                });
            }

            const nodedict = addNode("ValueOperations-StringDictionary");
            const throttled_write = addNode("RabbitMQOperations-ThrottledStringAction");
            addConnection(throttle_time, "output", throttled_write, "ms");
            addConnection(send_action, "action", throttled_write, "action");

            const send_string = addNode("ActionOperations-StringAction");
            addConnection(throttled_write, "throttled_action", send_string, "action");

            // Write the ID of this node into a key _ID
            const myid = addNode("Value-StringValue", { State: node.Id });
            const underscore_id = addNode("Value-StringValue", { State: "_ID" });
            const writeid = addNode("ValueOperations-DictionarySet");

            addConnection(nodedict, "output", writeid, "dict");
            addConnection(myid, "output", writeid, "value");
            addConnection(underscore_id, "output", writeid, "key");

            let dict_id = writeid.Id;

            // Look at its outputs
            for (const output of node.Outputs) {
                // Connect the output of this node to the serializer
                const serialize = addNode("ValueOperations-JSONSerializeOrNull");
                addConnection(node, output.Name, serialize, "input");

                // Connect the last dictionary output to this set
                const writedict = addNode("ValueOperations-DictionarySet");
                newconnections.push({
                    From: dict_id,
                    OutputPort: "output",
                    To: writedict.Id,
                    InputPort: "dict"
                })
                // Create and write a key value to it.
                const keystring = addNode("Value-StringValue", { State: output.Name });
                addConnection(keystring, "output", writedict, "key");
                addConnection(serialize, "json", writedict, "value");

                dict_id = writedict.Id;
            }

            // Serialize the final dict
            const serialize_dict = addNode("ValueOperations-JSONSerialize");
            addConnection({ Id: dict_id }, "output", serialize_dict, "input");
            // And connect to the throttled write
            addConnection(serialize_dict, "json", send_string, "data");
        }
        // console.log(graph);
        // console.log(newnodes);
        // console.log(newconnections);
        const amended_graph = {
            Nodes: [...graph.Nodes, ...newnodes],
            Connections: [...graph.Connections, ...newconnections]
        }

        try {
            await downstream_setgraph(amended_graph);
        } catch (e) {
            console.log("Got exception setting amended graph, trying original");
            console.log(e);
            await downstream_setgraph(graph);
            console.log("Original worked")
        }
    }

    // Tap a node
    const tap = (id, callback) => {
        if(!tapped.includes(id)) {
            tapped.push(id);
            runTap(last_graph);
        }

        events.on(id, callback);

        return () => {
            events.off(id,callback);
            tapped = tapped.filter(i => i !== id);
            runTap(last_graph);
        }
    }

    return {
        tap: tap,
        setGraph: setGraph,
        dispose: () => {
            subscription.unsubscribe();
            stomp.deactivate();
        }
    }
}
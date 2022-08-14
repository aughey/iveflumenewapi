export function CreateAPI(dispatchNodes, dispatchToasts) {
  return {
    addNode: info => {
      dispatchNodes({
        "type": "ADD_NODE",
        ...info
      });
    },
    removeNode: id => {
      dispatchNodes({
        "type": "REMOVE_NODE",
        "nodeId": id
      });
    },
    setNodeStyle: (id, style) => {
        dispatchNodes({
            "type": "SET_NODE_STYLE",
            "nodeId": id,
            "style": style
        });
    },
    addConnection: (fromId, fromPort, toId, toPort) => {
      dispatchNodes({
        "type": "ADD_CONNECTION",
        "output": {
          "nodeId": fromId,
          "portName": fromPort
        },
        "input": {
          "nodeId": toId,
          "portName": toPort
        }
      });
    },
    removeConnection: (fromId, fromPort, toId, toPort) => {
      dispatchNodes({
        "type": "REMOVE_CONNECTION",
        "output": {
          "nodeId": fromId,
          "portName": fromPort
        },
        "input": {
          "nodeId": toId,
          "portName": toPort
        }
      });
    },
    showToast: (title, message, type, duration) => {
      dispatchToasts({
        "type": "ADD_TOAST",
        "title": title,
        "message": message,
        "toastType": type,
        "duration": duration
      });
    }
  };
}

const Message = require("../models/messageModel");

exports.sendMessage = async (req, res) => {
    try {
        const { sender, receiver, groupId, message, type } = req.body;

        if (type === "direct" && !receiver) {
            return res.status(400).json({ error: "Receiver is required for direct messages" });
        }
        if (type === "group" && !groupId) {
            return res.status(400).json({ error: "Group ID is required for group messages" });
        }

        const newMessage = await Message.create({ sender, receiver, groupId, message, type });
        res.json(newMessage);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getMessages = async (req, res) => {
    try {
        const { sender, receiver, groupId, type } = req.query;
        let query = {};

        if (type === "direct") {
            if (!sender || !receiver) {
                return res.status(400).json({ error: "Sender and receiver are required for direct messages" });
            }
            query = { sender, receiver, type: "direct" };
        } else if (type === "group") {
            if (!groupId) {
                return res.status(400).json({ error: "Group ID is required for group messages" });
            }
            query = { groupId, type: "group" };
        }

        const messages = await Message.find(query).sort("timestamp");
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getMessagesForUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find messages where the current user is the receiver
        const messages = await Message.find({ receiver: userId }).sort({ timestamp: -1 }); // Sort by timestamp in descending order (latest first)

        if (!messages) {
            return res.status(404).json({ message: 'No messages found for this user.' });
        }

        // Return the messages
        res.status(200).json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};



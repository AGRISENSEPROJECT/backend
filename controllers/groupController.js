const Group = require("../models/groupModel");
const User = require("../models/User");

const createGroup = async (req, res) => {
    try {
        const { name, description, admin, members } = req.body;

        if (!name || !admin) {
            return res.status(400).json({ error: "Group name and admin are required" });
        }

        const group = await Group.create({ name, description, admin, members });
        res.json(group);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getGroups = async (req, res) => {
    try {
        const groups = await Group.find().populate("admin", "username").populate("members", "username");
        res.json(groups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getGroupById = async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate("admin", "username")
            .populate("members", "username");

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        res.json(group);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const addMember = async (req, res) => {
    try {
        const { groupId, userId } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }
        if (group.members.includes(userId)) {
            return res.status(400).json({ error: "User is already in the group" });
        }

        group.members.push(userId);
        await group.save();

        res.json({ message: "User added successfully", group });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const removeMember = async (req, res) => {
    try {
        const { groupId, userId } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        group.members = group.members.filter(member => member.toString() !== userId);
        await group.save();

        res.json({ message: "User removed successfully", group });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteGroup = async (req, res) => {
    try {
        const { groupId, adminId } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (group.admin.toString() !== adminId) {
            return res.status(403).json({ error: "Only the admin can delete the group" });
        }

        await Group.findByIdAndDelete(groupId);
        res.json({ message: "Group deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    createGroup,
    getGroups,
    getGroupById,
    addMember,
    removeMember,
    deleteGroup
};

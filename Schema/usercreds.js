import mongoose from "mongoose";
const userCreds = new mongoose.Schema({
    userName: {
        type: String,
        required: true,
        trim: true
    },
    emailId: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    userRole: {
        type:String,
        default:"user"
    },
    block: {
        type: Boolean,
        default:false
    },
    TotalMatches: {
        type: Number,
        default:0
    },
    win: {
        type: Number,
        default:0
    },
    lost: {
        type: Number,
        default:0
    },
    profileImage: { 
        type: Buffer, 
        required: false
    },
    imageType: {
        type: String,
        required: false
    }
});

const UserCreds = mongoose.model("UserCreds", userCreds);

export default UserCreds;

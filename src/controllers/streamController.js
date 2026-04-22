const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const StreamModel = require('../models/streamModel');

// GET /api/streams/token?channelName=xxx
const getAgoraToken = async (req, res) => {
  const { channelName } = req.query;
  if (!channelName) {
    return res.status(400).json({ success: false, message: 'Channel name is required' });
  }

  const appId = process.env.AGORA_APP_ID || '88c48c89abe947d48b95201c687546c0';
  const appCertificate = process.env.AGORA_APP_CERTIFICATE || '3a5798a8f193456599648ad2de3cd5a4';
  const uid = req.user.id;
  const role = RtcRole.PUBLISHER;
  const expirationTimeInSeconds = 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      privilegeExpiredTs
    );

    res.json({ success: true, data: { token, uid, appId } });
  } catch (error) {
    console.error('Agora Token Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate token' });
  }
};

// POST /api/streams/start
const startLive = async (req, res) => {
  const { channelName, title } = req.body;
  try {
    const stream = await StreamModel.startStream(req.user.id, channelName, title);
    res.status(201).json({ success: true, data: { stream } });
  } catch (error) {
    console.error('StartLive Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/streams/end
const endLive = async (req, res) => {
  const { channelName } = req.body;
  try {
    await StreamModel.endStream(channelName);
    res.json({ success: true, message: 'Stream ended' });
  } catch (error) {
    console.error('EndLive Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/streams/active
const getActive = async (req, res) => {
  try {
    const streams = await StreamModel.getActiveStreams();
    res.json({ success: true, data: { streams } });
  } catch (error) {
    console.error('GetActive Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getAgoraToken,
  startLive,
  endLive,
  getActive,
};

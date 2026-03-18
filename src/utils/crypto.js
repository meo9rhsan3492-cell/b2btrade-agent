/**
 * @fileoverview 配置加密模块 - API Key安全存储
 * @module src/utils/crypto
 *
 * @description
 * 提供简单但有效的配置加密功能
 * - 使用AES-256-CBC加密敏感数据
 * - 基于机器特征生成密钥
 * - 支持加密和解密操作
 */

import crypto from 'crypto';
import os from 'os';

/**
 * 加密算法配置
 */
const ALGORITHM = 'aes-256-cbc';
const SALT = 'b2btrade-agent-salt';
const ITERATIONS = 10000;

/**
 * 获取机器特征码
 * @returns {string} 机器特征码
 */
function getMachineId() {
  const cpus = os.cpus();
  const networkInterfaces = os.networkInterfaces();

  // 使用CPU信息和网络接口MAC地址生成机器码
  const cpuModel = cpus.length > 0 ? cpus[0].model : '';
  const macs = Object.values(networkInterfaces)
    .flat()
    .filter(i => i && !i.internal)
    .map(i => i.mac);

  return `${os.hostname()}-${cpuModel}-${macs.join(',')}-${os.platform()}`;
}

/**
 * 从机器特征派生密钥
 * @returns {Buffer} 32字节密钥
 */
function deriveKey() {
  const machineId = getMachineId();
  return crypto.pbkdf2Sync(machineId, SALT, ITERATIONS, 32, 'sha256');
}

/**
 * 加密字符串
 * @param {string} plainText - 明文
 * @returns {string} 加密后的字符串 (iv:encryptedData)
 */
export function encrypt(plainText) {
  if (!plainText) return '';

  try {
    const key = deriveKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 将IV和加密数据合并
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (e) {
    throw new Error(`加密失败: ${e.message}`);
  }
}

/**
 * 解密字符串
 * @param {string} encryptedText - 加密字符串 (iv:encryptedData)
 * @returns {string} 解密后的明文
 */
export function decrypt(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;

  try {
    const key = deriveKey();
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (e) {
    // 解密失败可能是旧格式或无效数据，返回原文
    return encryptedText;
  }
}

/**
 * 生成随机令牌
 * @param {number} length - 令牌长度
 * @returns {string} 随机令牌
 */
export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 哈希字符串
 * @param {string} text - 待哈希字符串
 * @returns {string} SHA256哈希值
 */
export function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * 验证数据完整性
 * @param {string} data - 原始数据
 * @param {string} signature - 签名
 * @returns {boolean} 是否有效
 */
export function verifySignature(data, signature) {
  const expected = hash(data);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * 加密配置文件中的敏感字段
 * @param {Object} config - 配置对象
 * @returns {Object} 加密后的配置
 */
export function encryptConfig(config) {
  const sensitiveFields = ['apiKey', 'accessToken', 'secretKey', 'password'];

  const encrypted = { ...config };

  for (const field of sensitiveFields) {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      // 检查是否已经加密（避免重复加密）
      if (!encrypted[field].includes(':') || !encrypted[field].match(/^[a-f0-9]+:/i)) {
        encrypted[field] = encrypt(encrypted[field]);
      }
    }
  }

  return encrypted;
}

/**
 * 解密配置文件中的敏感字段
 * @param {Object} config - 配置对象
 * @returns {Object} 解密后的配置
 */
export function decryptConfig(config) {
  const sensitiveFields = ['apiKey', 'accessToken', 'secretKey', 'password'];

  const decrypted = { ...config };

  for (const field of sensitiveFields) {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      decrypted[field] = decrypt(decrypted[field]);
    }
  }

  return decrypted;
}

export default {
  encrypt,
  decrypt,
  generateToken,
  hash,
  verifySignature,
  encryptConfig,
  decryptConfig
};

import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middlewares/validate';
import { registerSchema, loginSchema, refreshTokenSchema, updateProfileSchema } from './auth.schema';
import { authMiddleware } from '../../middlewares/auth';
import { upload } from '../../middlewares/upload';

const router = Router();

router.post('/register', upload.single('avatar'), validate(registerSchema), (req, res, next) => authController.register(req, res, next));
router.post('/login', validate(loginSchema), (req, res, next) => authController.login(req, res, next));
router.post('/refresh', validate(refreshTokenSchema), (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', authMiddleware, (req, res, next) => authController.logout(req, res, next));
router.get('/profile', authMiddleware, (req, res, next) => authController.profile(req, res, next));
router.put('/profile', authMiddleware, upload.single('avatar'), validate(updateProfileSchema), (req, res, next) => authController.updateProfile(req, res, next));

export default router;

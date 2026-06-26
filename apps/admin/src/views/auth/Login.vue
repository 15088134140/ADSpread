<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <h1>ADSpread</h1>
        <p>信发系统管理后台</p>
      </div>

      <el-form
        ref="formRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="请输入用户名"
            size="large"
            prefix-icon="User"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            prefix-icon="Lock"
            show-password
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-btn"
            :loading="loading"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-footer">
        <p>默认账号: admin / admin123</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { useUserStore } from '@/stores/user';
import { authApi } from '@/api/auth';
import type { LoginRequest } from '@adspread/types';

const router = useRouter();
const userStore = useUserStore();

const formRef = ref<FormInstance>();
const loading = ref(false);

const loginForm = reactive<LoginRequest>({
  username: 'admin',
  password: 'admin123',
});

const loginRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

const handleLogin = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        loading.value = true;
        const response = await authApi.login(loginForm);
        const { token, userInfo } = response;

        userStore.setToken(token);
        userStore.setUserInfo(userInfo);

        ElMessage.success('登录成功');
        router.push('/');
      } catch (error) {
        console.error('Login failed:', error);
      } finally {
        loading.value = false;
      }
    }
  });
};
</script>

<style scoped lang="scss">
.login-container {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

  .login-box {
    width: 400px;
    padding: 40px;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);

    .login-header {
      text-align: center;
      margin-bottom: 30px;

      h1 {
        font-size: 28px;
        font-weight: bold;
        color: #333;
        margin-bottom: 8px;
      }

      p {
        font-size: 14px;
        color: #666;
        margin: 0;
      }
    }

    .login-form {
      .login-btn {
        width: 100%;
      }
    }

    .login-footer {
      margin-top: 20px;
      text-align: center;

      p {
        font-size: 12px;
        color: #999;
        margin: 0;
      }
    }
  }
}
</style>

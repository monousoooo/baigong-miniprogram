<template>
  <view class="content">
    <image class="logo" src="/static/logo.png" />
    <view class="text-area">
      <text class="title">{{ isLoading }}</text>
    </view>
    <button @click="execute" :disabled="isLoading">请求</button>
  </view>
</template>

<script setup lang="ts">
import { useRequest } from "@/composables/useRequest";
import { ref } from "vue";
const title = ref("Hello");
const { data, isLoading, execute } = useRequest(
  "/api",
  {
    method: "POST",
  },
  {
    onError: (err) => {
      console.log(err);
    },
  }
);
</script>

<style>
.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.logo {
  height: 200rpx;
  width: 200rpx;
  margin-top: 200rpx;
  margin-left: auto;
  margin-right: auto;
  margin-bottom: 50rpx;
}

.text-area {
  display: flex;
  justify-content: center;
}

.title {
  font-size: 36rpx;
  color: #8f8f94;
}
</style>

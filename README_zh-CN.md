## 快速使用说明

> [!WARNING]
> 此后端服务基于copilot、gemini等构建的。
> 
> 其功能仍在测试。

### 安装环境

> 建议在一个虚拟环境中使用。
```
pip install -r requirements.txt
```

### 启动服务

此项目是对已有RAG库的再封装，目前使用 [lightRAG](https://github.com/HKUDS/LightRAG) 作为RAG的功能实现。感谢 LightRAG及其作者！

```
python ./src/main.py --db-path=./data --model-cache-path=./cache --openai-base-url="这里输入符合openai格式的任意大模型后端请求路径" --openai-api-key="这里输入你的Key"
```
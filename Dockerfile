FROM node:18-bullseye-slim
COPY . /app
WORKDIR /app
RUN --mount=type=secret,id=CONFIG,mode=0444,required=true \
	cat /run/secrets/CONFIG > /app/src/config.json && yarn install
EXPOSE 7860
ENV NODE_ENV=production
CMD [ "yarn", "start" ]

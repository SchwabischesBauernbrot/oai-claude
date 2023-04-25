FROM node:18-bullseye-slim
ADD ./* /app/
WORKDIR /app
RUN --mount=type=secret,id=ENV,mode=0444,required=true \
	cat /run/secrets/ENV > /app/.env && yarn install
EXPOSE 7860
ENV NODE_ENV=production
CMD [ "yarn", "start" ]

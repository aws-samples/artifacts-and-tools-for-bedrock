FROM public.ecr.aws/sam/build-nodejs20.x

WORKDIR /build
RUN mkdir /asset
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc
RUN mv node_modules /asset
RUN mv dist/* /asset && rm -rf dist 
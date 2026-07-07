# Multi-stage: build the Go backend, then ship it with Python (for media scripts in later phases).
FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/app ./server

FROM python:3.12-slim
WORKDIR /app
COPY --from=build /out/app /app/app
COPY web /app/web
COPY scripts /app/scripts
COPY shared /app/shared
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
RUN mkdir -p /app/other
ENV OTHER_DIR=/app/other
EXPOSE 8080
CMD ["/app/app"]

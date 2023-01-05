#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ShortUrlsStack } from '../lib/short_urls-stack';

const app = new cdk.App();
new ShortUrlsStack(app, 'ShortUrlsStack', { env: { region: "us-east-1" }, description: "S3 URL shortener" });